const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'b1jdghq2rryyo6yqh6zd-mysql.services.clever-cloud.com', // Host de Clever Cloud
    user: 'uzi6h1praq8e57dg', // Usuario de Clever Cloud
    password: 'frtZPdZMjZhalvR0rYq7', // Contraseña de Clever Cloud
    database: 'b1jdghq2rryyo6yqh6zd', // Nombre de la base de datos en Clever Cloud
    port: 3306, // Puerto de MySQL en Clever Cloud
    connectTimeout: 100000 // 10 segundos

});

connection.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos: ', err.stack);
        return;
    }
    console.log('Conectado a la base de datos MySQL en Clever Cloud con el id: ' + connection.threadId);
});

module.exports = connection;
