const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'inicio.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});

app.post('/signup', async (req, res) => {
    try {
        console.log("Body completo:", req.body);

        const { username, pass, name, lnames, fecnacim, photo } = req.body;

        console.log("Datos recibidos:");
        console.table({ username, pass, name, lnames, fecnacim, photo });

        res.json({
            status: "success",
            data: { username, pass, name, lnames, fecnacim, photo }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            status: "error",
            message: "No se pudo insertar el usuario"
        });
    }
});