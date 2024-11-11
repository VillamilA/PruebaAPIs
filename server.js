const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3001;

// Configuración de multer para almacenar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'public/models')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuración de la conexión a la base de datos MySQL en Clever Cloud
const db = mysql.createConnection({
    host: 'b1jdghq2rryyo6yqh6zd-mysql.services.clever-cloud.com',
    user: 'uzi6h1praq8e57dg',
    password: 'frtZPdZMjZhalvR0rYq7',
    database: 'b1jdghq2rryyo6yqh6zd',
    port: 3306
});

// Conexión a la base de datos MySQL
db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos: ', err);
    } else {
        console.log('Conectado a la base de datos MySQL en Clever Cloud');
    }
});

// Ruta para verificar si el nombre de usuario ya existe
app.get('/check-username', (req, res) => {
    const { name } = req.query;
    const query = "SELECT COUNT(*) AS count FROM tabla_usuarios WHERE nombre = ?";
    db.query(query, [name], (err, results) => {
        if (err) {
            console.error("Error al verificar el nombre de usuario: ", err);
            res.status(500).send('Error al verificar el nombre de usuario');
            return;
        }
        const exists = results[0].count > 0;
        res.json({ exists });
    });
});

// Ruta para subir archivos y guardar datos en MySQL
app.post('/upload', upload.single('photo'), (req, res) => {
    const { name, password } = req.body;
    const photo = req.file ? req.file.buffer : null;
    const codigo_empresa = 1;

    if (!photo) {
        console.error("No se ha proporcionado ninguna imagen");
        return res.status(400).json({ success: false, message: 'Se requiere una imagen' });
    }

    const query = "INSERT INTO tabla_usuarios (nombre, password, codigo_empresa, imagen) VALUES (?, ?, ?, ?)";
    db.query(query, [name, password, codigo_empresa, photo], (err, results) => {
        if (err) {
            console.error("Error completo al insertar usuario:", err);
            return res.status(500).json({ success: false, message: 'Error al insertar en la base de datos: ' + err.message });
        }
        res.status(200).json({ success: true, message: 'Usuario agregado correctamente' });
    });
});

// Ruta para obtener las etiquetas de los usuarios
app.get('/get-labels', (req, res) => {
    const query = "SELECT nombre FROM tabla_usuarios";
    db.query(query, (err, rows) => {
        if (err) {
            res.status(500).send('Error leyendo la base de datos');
            return;
        }
        const labels = rows.map(row => row.nombre);
        res.json(labels);
    });
});

// Ruta para verificar el nombre de usuario y la contraseña
app.get('/verify-login', (req, res) => {
    const { name, password } = req.query;
    const query = "SELECT COUNT(*) AS count FROM tabla_usuarios WHERE nombre = ? AND password = ?";
    db.query(query, [name, password], (err, results) => {
        if (err) {
            console.error("Error completo:", err);
            res.status(500).send('Error al verificar el inicio de sesión');
            return;
        }
        const exists = results[0].count > 0;
        res.json({ exists });
    });
});

// Ruta para obtener la imagen de un usuario
app.get('/get-image', (req, res) => {
    const name = req.query.name;
    const query = "SELECT imagen FROM tabla_usuarios WHERE nombre = ?";
    db.query(query, [name], (err, results) => {
        if (err || results.length === 0) {
            res.status(404).send('Imagen no encontrada');
            return;
        }
        res.setHeader('Content-Type', 'image/jpeg');
        res.send(results[0].imagen);
    });
});

// Ruta para obtener datos de la base de datos
app.get('/test-db', (req, res) => {
    const query = "SELECT * FROM tabla_usuarios LIMIT 1";
    db.query(query, (err, results) => {
        if (err) {
            console.error("Error al consultar la base de datos: ", err);
            res.status(500).send('Error al consultar la base de datos');
            return;
        }
        res.json(results);
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor iniciado en el puerto ${port}`);
});
