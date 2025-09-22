const express = require('express');
const bodyParser = require('body-parser');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.post('/slack/actions', async (req, res) => {
  try {
    const payload = JSON.parse(req.body.payload);
    const actionId = payload.actions?.[0]?.action_id;
    const user = payload.user?.username || 'unknown';

    // Parse job, title, and date from the button value
    const value = JSON.parse(payload.actions?.[0]?.value || '{}');
    const { job, title, date } = value;

    if (!job || !title || !date) {
      console.error('Missing job/title/date in Slack payload:', value);
      return res.status(400).json({ text: '⚠️ Missing job, title, or date', replace_original: true });
    }

    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Jobs List'];
    const rows = await sheet.getRows();

    // Match row by Job, Title, and either Start or End date
    const targetRow = rows.find(row =>
      row['Job']?.trim() === job.trim() &&
      row['Title']?.trim() === title.trim() &&
      (
        row['Start']?.trim() === date.trim() ||
        row['End']?.trim() === date.trim()
      )
    );

    if (!targetRow) {
      console.error(`No matching row found for Job: ${job}, Title: ${title}, Date: ${date}`);
      return res.status(404).json({ text: '⚠️ No matching job found', replace_original: true });
    }

    targetRow['Marked Complete'] = 'TRUE';
    targetRow['Percent Complete'] = 100;
    await targetRow.save();

    const emoji = actionId === 'resolve_job' ? '❗' : '✅';
    return res.json({ text: `${emoji} Job updated by @${user}`, replace_original: true });

  } catch (error) {
    console.error('Error handling Slack action:', error);
    return res.status(500).json({ text: '⚠️ Internal server error', replace_original: true });
  }
});

app.get('/', (req, res) => res.send('Slack interactivity server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
