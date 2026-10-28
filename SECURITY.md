# Security policy

## Supported versions

Security fixes land on `main` and are released with the next tag.

| version | supported |
| --- | --- |
| `main` | yes |
| latest release | yes |
| older releases | no |

## Reporting a vulnerability

Report privately through GitHub's **Security → Report a vulnerability**
advisory form on this repository. Do not open a public issue and do not post
details in a public discussion.

Please include:

- affected component (bot, API, web app, extension, mobile/desktop client),
- steps to reproduce, ideally a minimal request/sequence,
- impact and any suggested mitigation.

We aim to acknowledge within 72 hours and to ship a fix or mitigation plan
within 14 days. We will credit you in the advisory unless you prefer to stay
anonymous.

## Scope notes

This project records audio and transcripts. Treat these as sensitive by
default:

- transcripts must be encrypted at rest and in transit,
- audio and transcripts must never appear in logs or error messages,
- self-hosters are responsible for their own storage encryption and backups,
- recording consent is the deployer's responsibility; the product surfaces a
  consent notice in the bot and keeps a per-meeting consent record.
