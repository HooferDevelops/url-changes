// Load modules
import nodemailer from 'nodemailer';
import fs from "fs";
import path from "path";
import axios from "axios";

import {promisify} from "util";
import {diffChars, diffLines} from "diff";
import {fileURLToPath} from "url";

// Set up __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up promises for fs
const fsReadFile = promisify(fs.readFile);
const fsWriteFile = promisify(fs.writeFile);

// Check if config file exists
if (!fs.existsSync(path.join(__dirname, "config", "config.json"))) {
    // Create a copy of the default config file
    fs.copyFileSync(path.join(__dirname, "config", "config.json.default"), path.join(__dirname, "config", "config.json"));
}

// Load config file
const config = JSON.parse(fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf8"));
const emailNotifications = config.notifications.email
const scanning = config.scanning

// Create transporter for email notifications
const transporter = emailNotifications.enabled ? nodemailer.createTransport({
    host: emailNotifications.smtp.host,
    port: emailNotifications.smtp.port,
    secure: emailNotifications.smtp.secure,
    auth: {
        user: emailNotifications.smtp.auth.user == "" ? "NONE" : emailNotifications.smtp.auth.user,
        pass: emailNotifications.smtp.auth.pass == "" ? "NONE" : emailNotifications.smtp.auth.pass
    }
}) : false;

// Check the authentication of the username and password provided
let emailAuthenticationStatus = false
if (emailNotifications.enabled) {
    try {
        const res = await transporter.verify();
        emailAuthenticationStatus = res;
    } catch(e) {
        console.warn("! - Email authentication failed. Please check your SMTP configuration. - !");
        console.warn(e.message);
        console.warn("! ---------------------------------------------------------------------- !");
        emailAuthenticationStatus = false;
    }

    console.log("Email authentication status: " + (emailAuthenticationStatus ? "OK" : "FAILED"));
}

// Scan function
const scan = async () => {
    // Check if scanning is enabled
    if (!scanning.enabled) {
        console.warn("! - Scanning is disabled. - !");
        return false;
    }

    console.log("Attempting to scan for changes...");

    // Loop through the configured URLs
    scanning.urls.forEach(async (url) => {
        const request = await axios.get(url);
        const response = request.data;
        const status = request.status;

        // Ignore if the status is not 200
        if (status != 200) {
            return false;
        }

        const fileName = path.join(__dirname, "cache", url.replace(/([^a-z0-9]+)/gi, "") + ".cache")

        // Check if a cache file exists
        if (!fs.existsSync(fileName)) {
            // Create a new cache file
            await fsWriteFile(fileName, response, "utf8");

            // Return if the cache file was created
            return false;
        }

        // Read the cache file
        const cache = await fsReadFile(fileName, "utf8");

        // Compare the cache file with the response
        const diff = (scanning.compareLinesOnly ? diffLines : diffChars)(cache, response);
        
        if (diff.length > 2) {
            // Update the cache file
            await fsWriteFile(fileName, response, "utf8");

            // Send an email if enabled
            if (emailNotifications.enabled) {
                let results = "\n<span style='font-family: 'American Typewriter'; font-size: 12px;'>URL: " + url + "</span>\n\n<div style='background-color: #f5f5f5; padding: 10px; border-radius: 5px;'>";

                diff.forEach((part) => {
                    if (part.added) {
                        results += `<p style="color: green; padding: 0; margin: 0;">${part.value.replace(/[\<]/g,'&lt;').replace(/[\>]/g,'&gt;').replace(/[\n]/g,'<br>')}</p>\n`;
                    } else if (part.removed) {
                        results += `<p style="color: red; padding: 0; margin: 0; text-decoration: line-through;">${part.value.replace(/[\<]/g,'&lt;').replace(/[\>]/g,'&gt;').replace(/[\n]/g,'<br>')}</p>\n`;
                    } else {
                        results += `<p style="color: grey; padding: 0; margin: 0;">${part.value.replace(/[\<]/g,'&lt;').replace(/[\>]/g,'&gt;').replace(/[\n]/g,'<br>')}</p>\n`;
                    }
                })

                results += "</div>";

                // Send the email to all recipients
                emailNotifications.recipients.forEach((recipient) => {
                    
                    let subject = emailNotifications.subject.replace("{url}", url);

                    transporter.sendMail({
                        from: emailNotifications.from,
                        to: recipient,
                        subject: subject,
                        html: results,
                    });

                    console.log(`Email sent to ${recipient}`);
                });
            }
        }
    })
}


// Create our scan loop
const scanLoop = setInterval(scan, scanning.intervalMs);
scan()