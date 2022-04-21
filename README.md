# url-changes
 Scans a list of provided URLs for changes at a set interval.

# Installation

## NodeJS Requirements

Requires NodeJS >16.14.2 ( https://nodejs.org/en/download/ )

## Initial Installation

All commands are ran inside of the `src` directory after changing directories.

```bash
cd src
npm install
```

## Initial Setup

In order to generate an editable config, you have two options. You can either copy the `config.json.default` **->** `config.json` OR you may run the application once.

```bash
cd src
npm run start
```

# General Usage

## Starting the Program

To start the program, you must run the following command in the `src` directory after changing directories.

```bash
cd src
npm run start
```

## Configuration

## scanning
- enabled
    - Defines if scanning is enabled
- intervalMs
    - The interval used for scanning all URLs, in milliseconds
- urls
    - A list of all the URLs to be scanned
- compareLinesOnly
    - Decide if you should compare lines or individual characters in a string, this is recommended to be enabled

## notifications
- email
    - enabled
        - Defines if email notifications are enabled
    - recipients
        - A list of all email addresses that will recieve the notification
    - subject
        - The subject of the email, formats {url} to the updated website URL
    - from
        - The email address that is sending the emails, will not be used if `useSMTPFrom` is enabled.
    - useSMTPFrom
        - Defines if the SMTP authentication username should be used instead of the `from` field.
    - smtp
        - host
            - The main SMTP host address
        - port
            - The main SMTP host address port
        - secure
            - If the SMTP system should use TLS
        - auth
            - useEnv
                - Defines if environment variables should be used instead of the `user` and `pass` field.
            - user
                - Used for authentication, email username, will not be used if `useEnv` is enabled.
            - pass
                - Used for authentication, email password, will not be used if `useEnv` is enabled.