import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import cron from 'node-cron';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Get API key from environment variable
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

let reminders = [];

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('\n========================================');
    console.log('📱 SCAN THIS QR CODE WITH WHATSAPP:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
    console.log('\n========================================');
    console.log('Open WhatsApp > Menu > Linked Devices > Link Device');
    console.log('========================================\n');
});

client.on('ready', () => {
    console.log('✅ Bot is ready! Send yourself a message!');
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated!');
});

client.on('message', async (message) => {
    if (message.from.includes('@g.us')) return;
    
    const text = message.body.toLowerCase();
    
    if (text === 'help' || text === 'hi' || text === 'hello') {
        await message.reply(
            '👋 Hi! I\'m your reminder bot!\n\n' +
            '📝 Just tell me things like:\n' +
            '• "Remind me to call mom at 6pm"\n' +
            '• "Shopping list for tomorrow"\n' +
            '• "Meeting with boss at 3pm tomorrow"\n\n' +
            '📋 Type "list" to see all reminders\n' +
            '🗑️ Type "clear" to delete all reminders'
        );
        return;
    }
    
    if (text === 'list' || text === 'show') {
        if (reminders.length === 0) {
            await message.reply('📭 No reminders yet!');
        } else {
            let list = '📝 *Your Reminders:*\n\n';
            reminders.forEach((r, i) => {
                list += `${i + 1}. ${r.task}\n   ⏰ ${r.time || 'No time set'}\n\n`;
            });
            await message.reply(list);
        }
        return;
    }
    
    if (text === 'clear' || text === 'delete all') {
        reminders = [];
        await message.reply('🗑️ All reminders cleared!');
        return;
    }
    
    try {
        console.log('Processing:', message.body);
        
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Extract reminder details from: "${message.body}"
        
        Return ONLY a JSON object like this:
        {"task": "what to do", "time": "time mentioned or 'not specified'", "date": "date mentioned or 'today'"}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let aiText = response.text();
        
        aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(aiText);
        
        const reminder = {
            id: Date.now(),
            chatId: message.from,
            task: parsed.task,
            time: parsed.time,
            date: parsed.date,
            originalText: message.body,
            created: new Date().toLocaleString()
        };
        
        reminders.push(reminder);
        console.log('Saved reminder:', reminder);
        
        await message.reply(
            `✅ *Got it!*\n\n` +
            `📌 Task: ${parsed.task}\n` +
            `⏰ Time: ${parsed.time}\n` +
            `📅 Date: ${parsed.date}\n\n` +
            `Type "list" to see all reminders`
        );
        
    } catch (error) {
        console.error('Error:', error);
        await message.reply(
            '❌ Sorry, I didn\'t understand that.\n\n' +
            'Try saying:\n' +
            '• "Remind me to [task] at [time]"\n' +
            '• Type "help" for examples'
        );
    }
});

cron.schedule('* * * * *', () => {
    const now = new Date();
    console.log(`Checking reminders at ${now.toLocaleTimeString()}...`);
});

client.on('error', (error) => {
    console.error('Error:', error);
});

console.log('🚀 Starting bot...');
console.log('⏳ Please wait 30-60 seconds for QR code...');

client.initialize();

setInterval(() => {
    console.log('Bot is running...');
}, 60000);
