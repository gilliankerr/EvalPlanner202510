from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
from datetime import datetime
import os
import sys

# Add project root to Python path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from replitmail import send_email
except ImportError:
    # Mock function for development/testing
    def send_email(to, subject, text, attachments=None):
        print(f"MOCK EMAIL - Would send to: {to}")
        print(f"Subject: {subject}")
        print(f"Text: {text}")
        if attachments:
            print(f"Attachments: {len(attachments)} files")
        return True

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()})

@app.route('/send-report', methods=['POST'])
def send_report():
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'programName', 'organizationName', 'htmlContent']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400
        
        # Extract data
        user_email = data['email']
        program_name = data['programName']
        organization_name = data['organizationName']
        html_content = data['htmlContent']
        
        # Get current date and time
        current_datetime = datetime.now().strftime('%B %d, %Y at %I:%M %p %Z')
        
        # Create email body with user's specified template
        email_body = f"""Hello,

Attached is the evaluation plan you requested from the LogicalOutcomes Evaluation Planner.

It is for {program_name} delivered by {organization_name}. It was generated on {current_datetime}.

This is just a draft. If it is inaccurate, feel free to re-try the Evaluation Planner app but add additional useful information in the form.

If you have any questions, contact support@logicaloutcomes.com.

Best regards,
LogicalOutcomes Evaluation Planner"""
        
        # Create filename (sanitize for email attachment)
        filename = f"{organization_name}_{program_name}_Evaluation_Plan.html"
        filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        
        # Convert HTML to base64 for attachment
        html_bytes = html_content.encode('utf-8')
        base64_content = base64.b64encode(html_bytes).decode('utf-8')
        
        # Send email using Replit Mail integration
        send_email(
            to=user_email,
            subject=f"Evaluation Plan for {program_name} - {organization_name}",
            text=email_body,
            attachments=[{
                'filename': filename,
                'content': base64_content,
                'contentType': 'text/html',
                'encoding': 'base64'
            }]
        )
        
        return jsonify({
            "success": True,
            "message": f"Email sent successfully to {user_email}",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"Error sending email: {str(e)}")
        return jsonify({
            "error": f"Failed to send email: {str(e)}"
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    app.run(host='0.0.0.0', port=port, debug=True)