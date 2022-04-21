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
    
    // Warn the user
    throw new Error("Created a new config file for you. Please edit the file and restart the application.");
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
        user: emailNotifications.smtp.auth.useEnv ? process.env.user : emailNotifications.smtp.auth.user,
        pass: emailNotifications.smtp.auth.useEnv ? process.env.pass : emailNotifications.smtp.auth.pass
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
        let hasChanges = false

        // Check if there are changes
        diff.forEach((part) => {
            if (part.added || part.removed) {
                let ignored = false
                // Check to see if the part contains an ignored string
                scanning.ignoreList.forEach((ignore) => {
                    if (part.value.includes(ignore)) {
                        ignored = true
                    }
                })

                if (!ignored) {
                    hasChanges = true
                }
            }
        });

        if (hasChanges) {

            // Update the cache file
            await fsWriteFile(fileName, response, "utf8");

            // Send an email if enabled
            if (emailNotifications.enabled) {
                let results = ""

                diff.forEach((part) => {
                    if (!part.added && !part.removed) {
                        // Fill in every line except for the first two and last two new lines
                        part.value = part.value.split("\n")

                        if (part.value.length > 4*3) {
                            let unimportant = part.value.splice(2*3, part.value.length - 5*3, "...")
                        }

                        part.value = part.value.join("\n")
                    }
                    
                    results += `<div class="text-holder">
                                    <p class="${part.added ? "added" : (part.removed ? "removed" : "normal")}">
                                        ${part.value.replace(/[\<]/g,'&lt;').replace(/[\>]/g,'&gt;').replace(/[\n]/g,'<br>')}
                                    </p>
                                </div>
                                `;
                })

                results = `
                    <html>
                        <head>
                            <style>
                                body {
                                    
                                }

                                .content {
                                    width: fit-content;
                                    height: fit-content;
                                    display: inline-block;

                                    background-color: #edece8;
                                    margin: 20px;
                                    padding: 5px;
                                    border: 3px dashed #e0e0e0;
                                }

                                .text-holder {
                                    width: 100%;
                                }

                                p {
                                    color: #91908a;
                                    width: fit-content;
                                    display: inline-block;

                                    padding: 0px;
                                    margin: 0px;

                                    font-family: monospace;
                                    font-size: 20px;
                                }

                                .added {
                                    background-color: #b9f5ab;
                                    font-weight: bold;
                                }

                                .removed {
                                    background-color: #f5b6ab;
                                    text-decoration: line-through;
                                    font-weight: bold;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="content">
                                ${results}
                            </div>
                        </body>
                    </html>
                `

                // Send the email to all recipients
                emailNotifications.recipients.forEach((recipient) => {
                    
                    let subject = emailNotifications.subject.replace("{url}", url);

                    try {
                        transporter.sendMail({
                            from: emailNotifications.useSMTPFrom ? (emailNotifications.smtp.auth.useEnv ? process.env.user : emailNotifications.smtp.auth.user) : emailNotifications.from,
                            to: recipient,
                            subject: subject,
                            html: results,
                        });

                        console.log(`Email sent to ${recipient}`);
                    } catch(e) {
                        console.warn(`! - Email to ${recipient} failed. - !`);
                        console.warn(e.message);
                        console.warn("! --------------------------------- !");
                    }

                    
                });
            }
        }
    })
}


// Create our scan loop
const scanLoop = setInterval(scan, scanning.intervalMs);
scan()