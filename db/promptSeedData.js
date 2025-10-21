module.exports = [
  {
    step_name: 'prompt1',
    display_name: 'Prompt 1',
    content: `# Primary Objective

Analyze all available information and, using your expertise and web search as needed, define the program's key terms, goals, activities, target populations, and intended outcomes. Where details are missing, infer them based on best practices and analogous programs, clearly flagging any assumptions. Use the organization's own vocabulary when possible. Be sure you are focusing on {{programName}} and not on other programs delivered by the organization!

---

## Program Information

**Organization:** {{organizationName}}
**Program Name:** {{programName}}

**About the Program:**
{{aboutProgram}}

**Web Content:**
{{scrapedContent}}

---

## Output Requirements

Based on the provided information, do the following:

Identify and describe the underlying program model by analyzing:

• Target population and presenting issues addressed 
• Core intervention strategies and service delivery methods 
• Theoretical foundations and logic model (implicit or explicit)
• Program goals, intended outcomes, and theory of change
• Service intensity, duration, and delivery setting
• Staff roles and qualifications required

Deliver a comprehensive program model description including:

• Classification within established program typologies
• Key assumptions about how change occurs
• Primary mechanisms of action
• Comparison to similar evidence-based models in the literature

## Structured Data Extraction

After completing the comprehensive narrative analysis above, provide exactly one JSON object at the end with these specific keys:

- **program_type_plural**: A concise phrase describing the general type/category of program in plural form (e.g., "financial literacy programs", "mental health services", "after-school programs", "workforce development programs")
- **target_population**: A specific description of who the program serves (e.g., "low-income families in urban areas", "youth ages 12-18", "adults with substance use disorders", "rural communities")

Example JSON format:
\`\`\`json
{
  "program_type_plural": "financial literacy programs",
  "target_population": "low-income adults in Toronto"
}
\`\`\``,
    change_notes: 'Initial version - extracted from StepThree.tsx'
  },
  {
    step_name: 'prompt2',
    display_name: 'Prompt 2',
    content: `# Primary Objective

Building upon the program analysis already completed, create a comprehensive evaluation framework for {{programName}}. Use your expertise and web search as needed to develop specific evaluation approaches, metrics, and methodologies that align with the program model and theory of change identified in the analysis.

---

## Program Information

**Organization:** {{organizationName}}
**Program Name:** {{programName}}

**About the Program:**
{{aboutProgram}}

**Web Content:**
{{scrapedContent}}

**Program Analysis (from Prompt 1):**
{{programAnalysis}}

---

## Output Requirements

Based on the program analysis provided above, develop an evaluation framework that includes:

• Specific evaluation questions aligned with the program's theory of change
• Appropriate evaluation methodologies (process, outcome, impact)
• Key performance indicators and metrics for each program component
• Data collection methods suited to the program context and population
• Timeline and phases for evaluation implementation
• Stakeholder engagement strategies for the evaluation
• Considerations for equity, cultural appropriateness, and accessibility in evaluation design

Your framework should directly reference and build upon the program model, target population, intervention strategies, and outcomes identified in the Program Analysis section above. Do not re-analyze the program model; instead, focus on HOW to evaluate it effectively.`,
    change_notes: 'Updated to use programAnalysis from Step 3 as input - fixes dependency flow'
  },
  {
    step_name: 'report_template',
    display_name: 'Report Template',
    content: `# Primary Objective

Produce an accurate, detailed, and comprehensive evaluation plan that will guide a useful evaluation based on the previous analyses and by customizing the detailed document template below. The output should be one consolidated Markdown document that follows the exact structure and formatting rules specified below.

**CRITICAL: Do not wrap the output in triple backticks or code fences of any kind. Return plain Markdown text only. The output will be processed as Markdown and any code fences will break the formatting and prevent proper link rendering.**

---

## Program Information

**Organization:** {{organizationName}}
**Program Name:** {{programName}}

**About the Program:**
{{aboutProgram}}

**Web Content:**
{{scrapedContent}}

**Program Analysis:**
{{programAnalysis}}

**Evaluation Framework:**
{{evaluationFramework}}

---

## Internal Instructions

### General Rules for the Final Report

1. Deliver **one** consolidated Markdown file—nothing else.
2. Begin with the exact report title and end with the exact footer provided in the template.
3. Use **sentence case** for all headings and titles (e.g., ## Summary of the program).
4. Preserve every ## heading **exactly** as specified—no additions, deletions, or re-ordering.
5. Write in clear, accessible, non-jargon language (≈ 9th-grade reading level).
6. Clearly separate **user-provided facts** from **expert recommendations**.
    - Example phrasing:
        - "According to the program description, …" (user fact)
        - "Based on best practices for similar programs, …" (expert input)
7. Proofread for consistency, clarity, and grammar before output.

### Required Content & Structure

Follow **this template verbatim**—replace bracketed notes with actual content, but **do not change headings**:

# {{organizationName}} — {{programName}} Draft Evaluation Plan

Created on {{currentDate}} by LogicalOutcomes Evaluation Planner

This evaluation plan is designed to be a living document, supporting {{organizationName}} in its commitment to continuous improvement and demonstrating the impact of {{programName}}. The approach is collaborative and aims to provide actionable insights for program staff, management, and funders. It is guided by the principles of practical, utilization-focused evaluation. 

This plan does not include citations or research references. It is based on the [LogicalOutcomes Evaluation Planning Handbook](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4815131) by Gillian Kerr and Sophie Llewelyn, which describes a structured process that relies on general evidence about effective nonprofit programs, supported by an in-depth web search. 

We recommend that users also carry out a literature review to check that the evaluation plan is supported by peer-reviewed evidence in research journals. Our current recommended AI literature search tools are [Undermind](https://www.undermind.ai/) followed by [FutureHouse Falcon](https://platform.futurehouse.org/) and [Consensus](https://consensus.app/). The prompt should be something like, "I want to find empirical research (including peer-reviewed publications and high-quality gray literature) identifying essential program delivery elements and critical success factors for {{programTypePlural}} serving {{targetPopulation}}." Users can then re-do the evaluation planning app and paste the relevant parts of the literature review into the 'About the Program' box. 

## Program summary and analysis

This section synthesizes the information provided about {{programName}} enriched with an analysis of its context and program model.

### Summary of the program

(Provide a concise, 1-2 paragraph summary based on the program information provided. Start with a high-level statement of the program's purpose. Describe the core problem the program seeks to address, who it serves, and its primary activities.)

### Program overview

(In 2-3 paragraphs, describe the program's scope, core components, and overarching goals based on the program analysis. Detail the key services delivered and the intended flow of a participant's journey through the program.)

### Activities

(List the program's activities from the participant's perspective based on the program information. Group related activities under bolded categories. Use clear, action-oriented language.

**Example: Intake and Orientation**

• Receiving an orientation to program services
• Completing an intake assessment with a case manager

**Skill-Building Workshops**

• Attending weekly workshops on financial literacy
• Participating in mock job interviews)

### Desired impact

(Provide a bulleted list of the long-term changes or ultimate impact the program aims to achieve in the community or for its participants based on the program analysis.)

### Target population

(Describe the primary demographic and psychographic characteristics of the intended participants based on the program information. Include details on age, location, socioeconomic status, and any other specific criteria mentioned. If not provided, describe a typical target population for such a program.)

### Community context

(Describe the social, economic, and cultural environment in which the program operates based on available information. Analyze how the program is—or could be—tailored to the specific needs, assets, and challenges of this community.)

### Essential program processes

(Describe 5-7 evidence-based processes that are critical for the success of this program model. Always include the following processes customized for the program:

• **Feedback and quality control**: Establish a system for ongoing feedback that informs program changes and improvements.
• **Participatory decision-making**: Engage community members and participants in shaping the program, enhancing relevance and commitment.
• **Staff development**: Continuous training for staff to improve delivery and responsiveness.
• **Resource management**: Monitor use of resources to maintain program efficiency and sustainability)

### Critical success factors

(Synthesize the previous sections to identify the most critical factors for the program's success. This is an expert assessment. Present as a numbered list with brief explanations.)

### Main interest groups

(Describe each key interest group (e.g., Participants, Staff, Funders, Board of Directors, Community Partners). For each group, describe their relationship to the program and their likely interests in the evaluation. Use a stakeholder analysis approach but do not use the word 'stakeholder'.)

### Potential program risks

(Identify potential risks to the program's success using a risk matrix approach. Structure this by key interest groups and include evidence-based risk mitigation strategies. Be sure to consider the following risks and include them if relevant: 

- **Participants**: Potential for not feeling engaged or seeing visible benefits, leading to dropout.
- **Program staff**: Inadequate training leading to poorly delivered activities; Overwork and burnout due to high demands and potentially limited resources.
- **Community partners**: Misalignment of expectations and program objectives could strain relationships.
- **Cultural insensitivity**: Failing to resonate with or respect the diverse cultural backgrounds of participants can lead to disengagement and dissatisfaction.
- **Funders and sponsors**: Inefficient use of funds or lack of visible impact may result in reduced support.) 

### Areas of evaluation focus

(Based on the entire preceding analysis, propose 5-7 key areas that the evaluation should focus on that will lead to improvements in the program's effectiveness and address the risks listed above. Be sure to consider the following and include them if relevant:

1. **Participant engagement and retention**: Measure the levels of active participation and rate of dropout to evaluate engagement strategies.
2. **Staff satisfaction and turnover**: Regularly assess staff morale and turnover rates to ensure a supportive work environment.
3. **Program accessibility**: Evaluate the efficiency and sufficiency of transportation services and financial aid to ensure broad accessibility.
4. **Safety and well-being**: Monitor and report any safety incidents, and evaluate participants' well-being throughout the program.
5. **Cultural appropriateness**: Assess how well the program's activities respect and incorporate the cultural backgrounds of the community.
6. **Outcome achievement**: Regular assessments against predefined short-term, mid-term, and long-term goals to gauge program effectiveness and impact.)

## Program evaluation plan

This section outlines a comprehensive plan to evaluate the {{programName}} program, aligned with the principles of learning and accountability.

### Overview

(Provide a concise description of the evaluation's purpose, incorporating the program's goals, target demographics, and community context. State that the evaluation will assess process, effectiveness, and impact.)

### Evaluation objectives

List the following objectives of the evaluation as a numbered list, customized for the program. Do not add any other objectives unless they are clearly stated in program information:

1. Meet participant needs and help participants achieve their goals.
2. Achieve program goals and outcomes.
3. Improve program quality and fidelity.
4. Increase responsiveness to participants in the way services are provided.
5. Increase accessibility and equity in service provision (as defined by the program itself; e.g., for persons with disabilities, people living on low incomes, from defined racial or ethnic groups, for underserved groups in the target population).
6. Increase responsiveness to key interest groups (as defined by the program; e.g., to the broader community served, employees, volunteers, funders, donors).

### Evaluation questions

List the following evaluation questions, customized for the program: 

1. What activities are provided by the program?
2. To what extent is the program being implemented as designed and meeting quality standards?
3. What are the characteristics of the populations served by the program?
4. What do participants think about services and what are their suggestions?
5. What do staff and other key interest groups think about services and what are their suggestions? 
6. To what extent are participants meeting their goals?
7. What short-term and mid-term changes are participants experiencing?
8. What evidence suggests the program is contributing to its desired long-term impact?

### Logic model

Display the logic model for the current program evaluation. Customize the following logic model for the program. For example, change the logic model vocabulary to fit the program's vocabulary, for example instead of 'participants' the program may say 'clients', 'students', 'children' etc. Instead of 'Achieve program outcomes' the logic model should list those outcomes in a few words. Instead of 'Services provided', the logic model should list the activities that are carried out by program staff NOT the activities done by the participants. For example in an educational program, activities would include curriculum planning, providing workshops, collaborating with local school boards. Activities will always include process management to ensure program quality. This is a generic logic model that is suitable for most nonprofit programs; adapt it to be relevant but do not make major changes.

The logic model is outputted as a markdown table. The output is ONLY the markdown table.

| **INPUTS** | **ACTIVITIES** | **OUTPUTS** | **SHORT-TERM OUTCOMES** | **MID-TERM OUTCOMES** | **LONG-TERM OUTCOMES** |
|------------|----------------|-------------|-------------------------|-----------------------|-----------------------|
| Staff training and tools for service provision; Provider skill and effort; Management attention and effort; Financial resources | (List of program activities customized for this program); Quality assurance processes | Number of participants served; Services provided; Staff meetings on participant feedback and service quality | Participants' needs are met; Increased responsiveness to participants; Services are accessible and equitable; Program design improvements; Enhanced program quality and fidelity; Increased engagement with interest groups | Achieved program goals; Achieved participant goals; Improved management processes for continuous improvement; Increased program effectiveness; Enhanced cost-effectiveness; Increased financial support | Fulfilled program outcomes; Met community needs; Met participant needs; Enhanced organizational sustainability |

### Evaluation framework for {{programName}}

Present the evaluation framework in a Markdown table. This operationalizes the logic model. For each element, create a specific, measurable indicator.

Note to the user that the evaluation framework assumes that there is a client record system that tracks each participant. If the program does not have a client record system, the evaluation should focus on outputs and process measures rather than outcome measures since the results gained from surveys with low response rates will not be statistically valid. 

Customize the following table structure for the current program:

| Logic model element | Measure | Respondent | Mode of data collection | Comments |
| --- | --- | --- | --- | --- |
| OUTPUTS (reported quarterly) |     |     |     |     |
| Participants served | # participants | Project manager | Analysis of client record system or staff interviews | If possible, include demographic breakdown compared with targets linked to equity and inclusion objectives. |
| Services provided | # encounters/# episodes | Project manager | Analysis of client record system or staff interviews | Includes type of activity, encounters, episodes. Compare with target level of service delivery. |
| Delivery milestones for evaluation | # weeks +/- target; Quality rating; Thematic analysis of optional 'description' field | Project manager | Document review of progress reports; Observation or audit | Delivery dates for evaluation plan, data collection, clean data, progress and final reports etc. compared to target dates. Include quality rating e.g., evaluation plan has framework approved by sponsor. Data is clean and useful, consent obtained, minimum risk of harm, quality is good enough for purpose. |
| SHORT-TERM OUTCOMES (reported quarterly, though some data collection may be on annual schedule) |     |     |     |     |
| Meet participant needs | Goal questionnaire | Participant | Questionnaire or interview | Collected in client record system or with attached survey |
| Increase responsiveness to participants | Suggestions; Impact interview; Participant satisfaction; # team debriefs; Thematic analysis | Participant; Reviewer | Questionnaire or interview; Observation or audit | Multiple languages including audio, can cautiously include demographics and interest‑group type. Minimize "client satisfaction" surveys unless incorporated into service delivery. Team debriefs are based on notes from team meetings in which the agenda includes program quality and feedback from participants. |
| Improve program quality and fidelity | Implementation fidelity/ program quality; Analysis of process data | Reviewer | Observation or audit; Analysis of client record system | Include quality measure as part of client record system to ensure that correct services are being provided. Process data includes waiting time for intake, assessment, referrals. |
| Increase accessibility and equity to services | Suggestions; Impact interview; Analysis of intakes, dropouts compared to target population | Participant; Reviewer | Questionnaire or interview; Observation or audit | Changes made to program via notes, plans, responses from participants |
| Increase responsiveness to interest groups | Suggestions; Impact interview; Occasional satisfaction surveys | Interest group member | Questionnaire or interview; Observation or audit | Employees, local employers, community members, etc. Changes made to program via notes, plans, responses from participants. Minimize 'satisfaction' surveys unless incorporated into service changes. |
| MID-TERM OUTCOMES (reported annually) |     |     |     |     |
| Achieve participant goals | Success rate of participant goals – self-identified | Participant | Questionnaire or interview | Generally overlap between program goals and participant goals but not always. Collect in client record system if possible. |
| Achieve program goals | Success rate for program goals and outcomes | Interest group member | Questionnaire or interview; Analysis of client record system | Most measures should be from client record system if available, supplemented by surveys to interest groups. Minimize use of surveys unless results are incorporated into service delivery. |
| Increase program effectiveness and efficiency | Improvements in processes; Increased cost-benefit ratio for high quality outputs and goal achievements | Employee; Reviewer | Questionnaire or interview; Observation or audit | Include improved processes; Efficiency, productivity, cost-benefit ratio. Continuous improvement; Costs include job dissatisfaction as week as financial |
| Meet key interest group needs | Analysis of interest group responses | Interest group member; Reviewer | Questionnaire or interview; Observation or audit | Community, local employers, employees etc. Include funder and donor response to evaluation findings. |
| Improve organizational capacity | Specificity and responsiveness of organizational plans | Project manager or Reviewer | Observation or audit | Management plans, Board strategy, including budget and timelines. Includes extent to which evaluation results are addressed, and specificity of plan and budget. |
| LONG-TERM OUTCOMES (for ongoing monitoring 2+ years once monitoring and evaluation system is mature) |     |     |     |     |
| Achieve program outcomes | Aggregated mid-term program outcomes or separate long-term evaluation project | N/A | N/A | Include participant outcomes as well as any other long term program outcomes. Eventually via client record system. |
| Achieve community outcomes | Separate evaluation project | N/A | N/A | As related to program. May include funder/policy outcomes |
| Improve organizational sustainability | Separate evaluation project | N/A | N/A | Includes financial, human resources as well as governance and management processes |

## Evaluation phases, roles, and agendas

This evaluation will be conducted in four overlapping phases to ensure a structured and participatory process.

### Overview

This evaluation will follow a compressed timeline to provide rapid, useful feedback. The phases are designed to build on each other, from foundational planning and engagement to data analysis and reporting. The intent is to focus evaluation resources as much as possible on understanding and responding to interest group perspectives and on improving program quality.

The evaluation project includes the following activities divided into four overlapping phases:

- **Planning and initiation**: Activities 1 – 5 (duration: 3 to 8 weeks)
- **Design and development**: Activities 5 – 9 (duration: 1 to 12 weeks)
- **Implementation and analysis**: Activities 9 – 11 (ongoing until project completion)
- **Communication and discussion**: Activities 11 – 12 (duration: 3 to 6 weeks)

### 1. Engage the project sponsor, team members, and key decision-makers

- Confirm evaluation scope, budget and delivery date for the final report.
- Define the main roles and responsibilities for the evaluation project, including the manager who is overseeing the project and who will be taking the recommendations to senior management.
- Identify and invite members to an Evaluation Advisory Committee.
- Define the timelines, resources (including staff effort for interviews and data collection) and the decision process for approval of final report.

### 2. Define evaluation objectives and questions

- Facilitate a meeting with the advisory committee to discuss and revise the evaluation objectives and questions.
- Ensure evaluation questions are relevant to staff, meaningful to participants, and credible to funders.
- Confirm or revise the specific activities that are delivered by the program and that are essential to the program. Include direct services to participants as well as other essential elements such as collaboration with other organizations, staff training and financial management.
- Confirm or revise the key interest groups that should be engaged in data collection and/or discussion of the results.
- Finalize the evaluation framework, confirming that the indicators are measurable and meaningful.

### 3. Develop and test data collection tools

- Review and possibly adapt current client record system if one exists to assess whether it can generate reports for participant goals, milestones and activities. For example, every participant should be asked what they hope to get from the services, and if feasible asked later if they achieved their goals. 
- Draft all data collection tools (surveys, interview guides, tracking sheets). If possible, adapt and customize them from existing validated data collection tools to save time and improve validity.
- Pilot test the tools with a small group of participants and staff to ensure clarity and cultural appropriateness.
- Refine tools based on pilot feedback.

### 4. Collect and manage data

- Train staff or designated data collectors on protocols to ensure data quality and consistency.
- Deploy surveys, conduct interviews, and analyze client records as per the evaluation framework.
- Ensure ethical protocols, including informed consent and data confidentiality, are strictly followed.
- Frequent interim reports will assess whether the data appears to be accurate and whether it captures feedback from defined interest groups and demographic groups.
- If necessary, additional demographic segments may be targeted with additional interviews or financial incentives.

### 5. Analyze data and interpret findings

- Clean and analyze quantitative and qualitative data.
- Deliver reports frequently to appropriate staff and interest groups with a focus on recommended actions. Emerging findings may be tested with follow-up interviews or more detailed reports.
- Notes from staff meetings will be reviewed for evidence of actions that have been taken or recommendations that have been made as a result of the reports.
- Hold a "sense-making" session with the advisory committee and staff to interpret the initial findings, discuss implications, and co-develop recommendations. This participatory step is crucial for ensuring the results are understood and owned by the team.

### 6. Communicate findings and facilitate use

- Draft a comprehensive evaluation report with a clear executive summary.
- Develop tailored communication materials for different groups (e.g., one-page summary for the board, presentation for staff, stories for a newsletter).
- Facilitate a final meeting to a discuss the report and create an action plan for implementing the recommendations.

### Roles and meeting agendas

It is necessary to involve senior managers and decision-makers in the evaluation process so that the resulting information will be relevant and credible to them. They should be engaged at three stages:

1. Defining objectives, roles and key interest groups at the beginning of the evaluation.
2. Engaging with data as soon as it starts to be collected and then occasionally throughout the project.
3. Engaging with the final recommendations and action plans near the end of the evaluation.

In addition, representatives of the organization need to be involved more deeply in:

1. Defining the program services and key processes.
2. Defining project timelines and tracking quality.
3. Configuring the client record system and refining the data collection tools.

And of course members of key interest groups will be asked for input as part of the data collection activities.

Following are agenda templates for these key meetings. The attendees represent the minimum roles required for a successful evaluation. Other roles may be invited depending on the needs of the project.

There are four essential roles for a successful evaluation project:

**Sponsor** (generally a senior manager who will be responsible for implementing recommendations)

- Provide guidance regarding overall objectives and constraints of project
- Liaise with the organization's senior management and manage organizational expectations and scope issues as appropriate
- Communicate with internal and external interest groups regarding project progress
- Remove roadblocks to project success and respond to project risks and problems as they are identified by the Project Manager or Liaison
- Approve significant changes to the project scope, timeline, budget, or quality if required
- Review and approve project documents and other deliverables

**Liaison** (generally a manager at the organization reporting to the Project Sponsor)

- Act as the primary contact person with the evaluator
- Liaise with the Project Sponsor and take on their responsibilities as delegated
- Act as a project manager from the organization's side, e.g., scheduling meetings with program staff, negotiating with I.T. staff

**Project Owner** (generally a senior external evaluator)

- Provide project leadership for the evaluation as a whole
- Define project methodologies and advise on strategic issues
- Author, review and approve project documents as assigned
- Manage and resolve team-level risks, issues, and changes
- Remove roadblocks to project success and respond to project risks and problems as they are identified by the Project Manager or Project Sponsor
- Review and provide detailed feedback regarding all project documents and deliverables

**Project Manager** (generally an external evaluator reporting to the Project Owner)

- Act as liaison to the organization for operational issues
- Monitor project scope, quality, schedule, resources, costs and risks
- Coordinate implementation of project work
- Ensure project plan, schedule, and budget are up-to-date; detect and manage discrepancies
- Report risks, delays and problems to Project Owner and Project Sponsor as they arise
- Author, review and approve project documents as assigned to ensure the quality standards are met
- Arrange and follow-up on team meetings
- Manage and contribute to data collection, analysis and report writing
- Provide leadership and manage work as appropriate

**Program staff** (one or more representatives of the people who will actually implement service improvements and experience changes in their workplace)

Other common roles include I.T. specialists, program participants and representatives from key constituencies.

At a bare minimum, not including meetings that involve only the Project Liaison and Project Manager, the project should have four structured meetings with organizational representatives, e.g., by holding a full day workshop to combine steps 2 and 3.

| Meeting Purpose | Deliverables | Minimum attendees (always includes project manager) | Notes |
| --- | --- | --- | --- |
| 1. Initiate the project | Draft of Evaluation Plan | Liaison | The agenda for this meeting is to clarify and confirm the evaluation's objectives, methodology, roles and timelines, using this report as a working draft. The Project Manager and Liaison revise this report with input from Statement of Work, proposal and program documents. |
| 2. Define objectives, roles and key interest groups | Approved Evaluation Plan | Project Owner, Sponsor, Liaison, program staff | This meeting involves the organization's decision-makers and program staff to build engagement in the evaluation, to decide on priorities, and to commit on how they will handle problems as they arise. The completed Evaluation Plan is approved by the Sponsor shortly after the meeting. |
| 3. Configure client record system and data collection tools | Revise or design client record system and approved data collection tools | Liaison, program staff | Use existing tools as much as possible. If further discussion needed offer additional meetings to subgroup |
| 4. Track progress and troubleshoot problems | Progress report | Liaison | This can be combined with other meetings. The purpose is to discuss delays and solve problems as they arise. |
| 5. Engage with data | Meeting notes with actions | Liaison, program staff (monthly at first, then bimonthly) | These meetings should be a recurring agenda item in regular program staff meetings, if feasible. Part of the purpose is to get staff accustomed to responding to participant feedback in their staff meetings as a normal reflective practice. Emerging conclusions should be addressed early and often so that staff get a chance to contribute to recommendations before they are presented to senior management. |
| 6. Engage with recommendations | Revised conclusions and recommendations | Project Owner, Project Sponsor, Liaison, Project Owner, program staff | This may require multiple meetings with different interest groups, with revisions at each stage incorporating their feedback. The meetings should present only conclusions and recommendations to encourage discussion. Technical details should be available for questions and circulated to interested interest groups. |

---

Generated by LogicalOutcomes Evaluation Planner on {{currentDate}}

Now customize this entire template for the specific program described in the program information, analysis, and framework. Replace all bracketed content with program-specific information. Make sure to:

1. Use the exact headings as specified
2. Customize all content to be specific to {{programName}} at {{organizationName}}
3. Base all content on the program analysis and information provided
4. Follow the sentence case formatting for headings
5. Include the exact boilerplate text for the implementation phases and roles sections
6. Create program-specific logic model and evaluation framework tables
7. Make the content accessible and clear (9th grade reading level)`,
    change_notes: 'Initial version - extracted from StepFive.tsx'
  },
  {
    step_name: 'email_delivery',
    display_name: 'Email Delivery Template',
    content: `Hello, attached is the evaluation plan you requested from the LogicalOutcomes Evaluation Planner at www.logicaloutcomes.net. 

It is for {{programName}} delivered by {{organizationName}}. It was generated on {{currentDateTime}}. 

This is just a draft and should be reviewed carefully for accuracy. To improve its accuracy, feel free to re-try the Evaluation Planner app and add relevant information in the form. For example, paste additional web pages about the organization or information about the population served or the results of a literature review on effective program models. 

Best regards,
LogicalOutcomes`,
    change_notes: 'Initial version - extracted from StepSix.tsx email body'
  }
]
