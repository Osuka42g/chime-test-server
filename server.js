/* eslint-disable */
const compression = require("compression");
const fetch = require("isomorphic-fetch");
const url = require("url");
const uuid = require("uuid/v4");
const AWS = require("aws-sdk");
/* eslint-enable */

let hostname = "127.0.0.1";
let port = 8080;
let protocol = "http";
let options = {};

const chime = new AWS.Chime({ region: "us-east-1" });
chime.endpoint = new AWS.Endpoint(
  "https://service.chime.aws.amazon.com/console"
);

const meetingCache = {};
const attendeeCache = {};

const log = (message) => {
  console.log(`${new Date().toISOString()} ${message}`);
};

const server = require(protocol).createServer(
  options,
  async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Request-Method", "*");
    response.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
    response.setHeader("Access-Control-Allow-Headers", "*");

    log(`${request.method} ${request.url} BEGIN`);
    compression({})(request, response, () => {});
    try {
      if (request.method === "GET" && request.url === "/") {
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html");
        response.end("There is someone staring behind you");
      } else if (
        request.method === "POST" &&
        request.url.startsWith("/join?")
      ) {
        const query = url.parse(request.url, true).query;

        const { callId, callee, caller, spaceId } = query;

        const title = callId;

        if (!meetingCache[title]) {
          meetingCache[title] = await chime
            .createMeeting({
              ClientRequestToken: uuid(),
            })
            .promise();
          attendeeCache[title] = {};
        }
        const joinInfo = {
          Title: callId,
          Meeting: meetingCache[title].Meeting,
          Attendee: (
            await chime
              .createAttendee({
                MeetingId: meetingCache[title].Meeting.MeetingId,
                ExternalUserId: uuid(),
              })
              .promise()
          ).Attendee,
          Host: (
            await chime
              .createAttendee({
                MeetingId: meetingCache[title].Meeting.MeetingId,
                ExternalUserId: uuid(),
              })
              .promise()
          ).Attendee,
        };
        // attendeeCache[title][joinInfo.JoinInfo.Attendee.AttendeeId] = name;
        // attendeeCache[title][joinInfo.JoinInfo.Host.AttendeeId] = name;
        response.statusCode = 201;
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Access-Control-Allow-Origin", "*");

        const meetingConfig = {
          spaceId: spaceId,
          callType: "DUO",
          provider: "CHIME",
          // corpAcctNum: corpAcctNum,
          meeting: {
            type: "chime",
            meetingId: joinInfo.Meeting.MeetingId,
            externalMeetingId: joinInfo.Meeting.ExternalMeetingId,
            mediaPlacement: {
              audioHostUrl: joinInfo.Meeting.MediaPlacement.AudioHostUrl,
              audioFallbackUrl:
                joinInfo.Meeting.MediaPlacement.AudioFallbackUrl,
              screenDataUrl: joinInfo.Meeting.MediaPlacement.ScreenDataUrl,
              screenSharingUrl:
                joinInfo.Meeting.MediaPlacement.ScreenSharingUrl,
              screenViewingUrl:
                joinInfo.Meeting.MediaPlacement.ScreenViewingUrl,
              signalingUrl: joinInfo.Meeting.MediaPlacement.SignalingUrl,
              turnControlUrl: joinInfo.Meeting.MediaPlacement.TurnControlUrl,
            },
            mediaRegion: joinInfo.Meeting.TurnControlUrl,
          },
          participants: [
            {
              email: callee,
              accessCode: null,
              type: "REGULAR",
              joinInfo: {
                attendeeId: joinInfo.Attendee.AttendeeId,
                joinToken: joinInfo.Attendee.JoinToken,
              },
            },
            {
              email: caller,
              accessCode: null,
              type: "HOST",
              joinInfo: {
                attendeeId: joinInfo.Host.AttendeeId,
                joinToken: joinInfo.Host.JoinToken,
              },
            },
          ],
          callId: callId,
        };

        var myHeaders = new Headers();
        myHeaders.append("Content-Type", "application/json");
        myHeaders.append("Cookie", "cospacexdid1=5ea70d4e9b898");

        var options = {
          method: "POST",
          headers: myHeaders,
          maxRedirects: 20,
          body: JSON.stringify(meetingConfig),
          redirect: 'follow',
        };

        const joinInfoResponse = await fetch(
          `https://local.cospace.app/bin/api/join_info.php`,
          options
        );
        const json = await joinInfoResponse.json();
        console.log('json', json)
        if (json.error) {
          throw new Error(`Server error: ${json.error}`);
        }
        // return json;

        response.write(JSON.stringify(meetingConfig), "utf8");
        response.end();
        // log(JSON.stringify(joinInfo, null, 2));
      } else if (
        request.method === "GET" &&
        request.url.startsWith("/attendee?")
      ) {
        const query = url.parse(request.url, true).query;
        const attendeeInfo = {
          AttendeeInfo: {
            AttendeeId: query.attendee,
            Name: attendeeCache[query.title][query.attendee],
          },
        };
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.write(JSON.stringify(attendeeInfo), "utf8");
        response.end();
        log(JSON.stringify(attendeeInfo, null, 2));
      } else if (
        request.method === "POST" &&
        request.url.startsWith("/meeting?")
      ) {
        const query = url.parse(request.url, true).query;
        const title = query.title;
        if (!meetingCache[title]) {
          meetingCache[title] = await chime
            .createMeeting({
              ClientRequestToken: uuid(),
            })
            .promise();
          attendeeCache[title] = {};
        }
        const joinInfo = {
          JoinInfo: {
            Title: title,
            Meeting: meetingCache[title].Meeting,
          },
        };
        response.statusCode = 201;
        response.setHeader("Content-Type", "application/json");
        response.write(JSON.stringify(joinInfo), "utf8");
        response.end();
        log(JSON.stringify(joinInfo, null, 2));
      } else if (request.method === "POST" && request.url.startsWith("/end?")) {
        const query = url.parse(request.url, true).query;
        const title = query.title;
        await chime
          .deleteMeeting({
            MeetingId: meetingCache[title].Meeting.MeetingId,
          })
          .promise();
        response.statusCode = 200;
        response.end();
      } else if (request.method === "POST" && request.url.startsWith("/logs")) {
        console.log("Writing logs to cloudwatch");
        response.end("Writing logs to cloudwatch");
      } else {
        response.statusCode = 404;
        response.setHeader("Content-Type", "text/plain");
        response.end("404 Not Found");
      }
    } catch (err) {
      log(`server caught error: ${err}`);
      response.statusCode = 403;
      response.setHeader("Content-Type", "application/json");
      response.write(JSON.stringify({ error: err.message }), "utf8");
      response.end();
    }
    log(`${request.method} ${request.url} END`);
  }
);

server.listen(port, hostname, () => {
  log(`server running at ${protocol}://${hostname}:${port}/`);
});
