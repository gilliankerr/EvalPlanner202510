const prompts = require('./promptSeedData');

async function seedPrompts(pool, options = {}) {
  const { quiet = false } = options;
  const log = quiet ? () => {} : console.log;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const prompt of prompts) {
      const insertPromptResult = await client.query(
        `INSERT INTO prompts (step_name, display_name, content, is_active, current_version)
         VALUES ($1, $2, $3, true, 1)
         ON CONFLICT (step_name) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           content = EXCLUDED.content,
           updated_at = NOW()
         RETURNING id`,
        [prompt.step_name, prompt.display_name, prompt.content]
      );

      let promptId;
      if (insertPromptResult.rows.length > 0) {
        promptId = insertPromptResult.rows[0].id;
      } else {
        const fallback = await client.query(
          'SELECT id FROM prompts WHERE step_name = $1',
          [prompt.step_name]
        );
        promptId = fallback.rows[0]?.id;
      }

      if (!promptId) {
        throw new Error(`Failed to determine ID for prompt ${prompt.step_name}`);
      }

      await client.query(
        `INSERT INTO prompt_versions (prompt_id, version_number, content, change_notes)
         VALUES ($1, 1, $2, $3)
         ON CONFLICT (prompt_id, version_number) DO NOTHING`,
        [promptId, prompt.content, prompt.change_notes]
      );

      log(`Seeded prompt: ${prompt.display_name}`);
    }

    await client.query('COMMIT');
    log('All prompts seeded successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { seedPrompts };
