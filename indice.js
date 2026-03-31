const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/inicio.html');
});

app.get('/SignUp.html', (req, res) => {
    res.sendFile(__dirname + '/SignUp.html');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

app.post('/signup', async (req, res) => {
    try {
        const { username, pass, name, lnames, fecnacim, photo } = req.body;

        console.log("Datos recibidos:");
        console.table({ username, pass, name, lnames, fecnacim, photo });

        res.json({
            status: "success"
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: "error",
            message: "No se pudo insertar el usuario"
        });
    }
});