const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

const sendBlockedNotification = async (email, username, ip) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'TEC Digitalito — Cuenta bloqueada',
    html: `
      <p>Hola <strong>${username}</strong>,</p>
      <p>Tu cuenta ha sido bloqueada temporalmente por 15 minutos debido a 5 intentos fallidos de inicio de sesión desde la dirección IP <strong>${ip}</strong>.</p>
      <p>Si no fuiste tú, te recomendamos cambiar tu contraseña una vez que recuperes el acceso.</p>
      <p>TEC Digitalito</p>
    `
  });
};

const sendSuspiciousActivity = async (email, username, ip, device) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'TEC Digitalito — Actividad sospechosa detectada',
    html: `
      <p>Hola <strong>${username}</strong>,</p>
      <p>Se detectó un intento de acceso sospechoso a tu cuenta:</p>
      <ul>
        <li>IP: ${ip}</li>
        <li>Dispositivo: ${device}</li>
        <li>Fecha: ${new Date().toLocaleString('es-CR')}</li>
      </ul>
      <p>Si no fuiste tú, cambia tu contraseña inmediatamente.</p>
      <p>TEC Digitalito</p>
    `
  });
};

const sendPasswordResetEmail = async (email, resetLink) => {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'TEC Digitalito — Recuperar contraseña',
    html: `
      <p>Recibimos una solicitud para restablecer tu contraseña.</p>
      <p>Haz clic en el siguiente enlace (válido por 15 minutos):</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Si no solicitaste esto, ignora este correo.</p>
      <p>TEC Digitalito</p>
    `
  });
};

module.exports = { sendBlockedNotification, sendSuspiciousActivity, sendPasswordResetEmail };
