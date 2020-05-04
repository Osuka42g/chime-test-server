## Browser Meeting Server

This demo shows how to use the Amazon Chime SDK to build meeting applications for browsers.

### Prerequisites

To run you will need:

* Node 10 or higher
* npm 6.11 or higher

Ensure you have AWS credentials configured in your `~/.aws` folder for a
role with a policy allowing `chime:CreateMeeting`, `chime:DeleteMeeting`, and
`chime:CreateAttendee`.


### Server application

```
npm install
npm run start
```
