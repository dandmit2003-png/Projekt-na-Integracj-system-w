const express = require('express');
const cors = require('cors');
const amqp = require('amqplib');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = "super_tajny_klucz_comprent_2026";
let channel = null;

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect('amqps://jyawgigi:GWt4CoMVWWdOO_RP7PUaRNZNxVJ_DbwK@rat.rmq2.cloudamqp.com/jyawgigi');
        channel = await connection.createChannel();
        await channel.assertQueue('apple_queue', { durable: true });
        await channel.assertQueue('windows_queue', { durable: true });
        console.log('Połączono z RabbitMQ. Kolejki gotowe.');
    } catch (err) {
        console.error('Błąd RabbitMQ:', err.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}
connectRabbitMQ();

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@comprent.pl' && password === 'admin123') {
        const token = jwt.sign({ id: 1, role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, user: { id: 1, name: 'Danylo', surname: 'Melikhov', role: 'admin' } });
    } else {
        res.status(401).json({ error: 'Błędne dane logowania' });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Brak tokenu' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token nieprawidłowy' });
        req.user = user;
        next();
    });
}

app.post('/api/rent', authenticateToken, (req, res) => {
    const { productName, brand, price, userId } = req.body;
    if (!channel) return res.status(503).json({ error: 'Broker niedostępny' });
    const message = JSON.stringify({ productName, brand, price, userId, rentalDate: new Date().toISOString() });
    const routingKey = brand === 'Apple' ? 'apple_queue' : 'windows_queue';
    try {
        channel.sendToQueue(routingKey, Buffer.from(message), { persistent: true });
        console.log(`[Router] "${productName}" → ${routingKey}`);
        res.status(202).json({ message: `Wysłano do ${routingKey}` });
    } catch (err) {
        res.status(500).json({ error: 'Błąd kolejki' });
    }
});

app.listen(3000, () => console.log('ESB/Router działa na http://localhost:3000'));