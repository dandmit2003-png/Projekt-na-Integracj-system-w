const amqp = require('amqplib');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./warehouse.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        productName TEXT,
        brand TEXT,
        price REAL,
        userId INTEGER,
        rentalDate TEXT,
        systemType TEXT,
        savedAt TEXT
    )`);
});
console.log('Baza warehouse.db gotowa.');

async function saveToDatabase(data, systemType, maxRetries = 3) {
    for (let i = 1; i <= maxRetries; i++) {
        try {
            if (Math.random() < 0.3) throw new Error('Baza chwilowo niedostępna');
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO rentals (productName, brand, price, userId, rentalDate, systemType, savedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [data.productName, data.brand, data.price, data.userId, data.rentalDate, systemType, new Date().toISOString()],
                    function (err) { if (err) reject(err); else resolve(); }
                );
            });
            console.log(`[Próba ${i}] Zapisano: ${data.productName} (${systemType})`);
            return true;
        } catch (err) {
            console.warn(`[Próba ${i}/${maxRetries}] ${err.message} — czekam 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    console.error(`Nie udało się zapisać: ${data.productName}`);
    return false;
}

async function startWorker() {
    try {
        const connection = await amqp.connect('amqps://jyawgigi:GWt4CoMVWWdOO_RP7PUaRNZNxVJ_DbwK@rat.rmq2.cloudamqp.com/jyawgigi');
        const channel = await connection.createChannel();
        await channel.assertQueue('apple_queue', { durable: true });
        await channel.assertQueue('windows_queue', { durable: true });
        channel.prefetch(1);

        channel.consume('apple_queue', async (msg) => {
            if (!msg) return;
            const data = JSON.parse(msg.content.toString());
            console.log(`[apple_queue] Odebrano: ${data.productName}`);
            const ok = await saveToDatabase(data, 'Apple');
            if (ok) channel.ack(msg); else channel.nack(msg, false, true);
        });

        channel.consume('windows_queue', async (msg) => {
            if (!msg) return;
            const data = JSON.parse(msg.content.toString());
            console.log(`[windows_queue] Odebrano: ${data.productName}`);
            const ok = await saveToDatabase(data, 'Windows');
            if (ok) channel.ack(msg); else channel.nack(msg, false, true);
        });

        console.log('Worker nasłuchuje na kolejkach RabbitMQ...');
    } catch (err) {
        console.error('Błąd RabbitMQ:', err.message);
        setTimeout(startWorker, 5000);
    }
}
startWorker();