const nodemailer = require("nodemailer");

require("dotenv").config();
class MailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",

      auth: {
        user: "anasyoussef649@gmail.com",
        pass: "vqav rdst kzig qzib",
      },
    });
  }

  async sendMail(to, otp, html = null) {
    try {
      const mailOptions = {
        from: "anasyoussef649@gmail.com",
        to: to,
        subject: "كود التحقق",
        text: `أدخل ${otp} كود التحقق`,
        html: html || text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  sendOTPTemplate = (otp) => {
    const html = `
      <html>
        <body>
          <h1>كود التحقق</h1>
          <p>أدخل ${otp} كود التحقق</p>
        </body>
      </html>
    `;
    return html;
  };
}

module.exports = new MailService();
