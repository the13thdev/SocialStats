//Importing modules
var express = require('express');
var morgan = require('morgan');
var request = require('request');
var path = require('path');

//data Variables
const IG_QUERY_ID = "17888483320059182";
const HOMEPAGE_URL = "https://www.instagram.com/";
const GRAPH_QUERY_URL = "https://www.instagram.com/graphql/query/";
const NUMBER_OF_POSTS_TO_FETCH = 1000;

//initializing express
var app = express();

//setting port to listen on
app.set('port', (process.env.PORT || 5000));
//setting static public directory for public  css,js and html files.
app.use(express.static('public'))
//middleware for logging requests
app.use(morgan('dev'));

app.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get('/getProfileData', function(req, res, next) {
  if (req.query.ig_username) {
    var userProfileURL = HOMEPAGE_URL + req.query.ig_username + "?__a=1";
    request.get({
        url: userProfileURL
      },
      function(error, response, body) {

        if (!error && response.statusCode == 200) {
          //Data Successfully loaded
          console.log("data fetched Successfully from url " + userProfileURL);
          var response_data = {};
          response_data.user_details = JSON.parse(body);
          var user_id = response_data.user_details.user.id;
          console.log("..user_id is " + user_id);
          request.get({
              url: GRAPH_QUERY_URL,
              qs: {
                "query_id": IG_QUERY_ID,
                "variables": JSON.stringify({
                  "id": user_id,
                  "first": NUMBER_OF_POSTS_TO_FETCH
                })
              }
            },
            function(error, response, body) {
              if (!error && response.statusCode == 200) {
                console.log("data fetched Successfully from graph query url");
                response_data.user_media = JSON.parse(body);
                res.json(response_data);
              } else {
                res.json(createErrorResponse("GRAPH_QUERY_ERROR","Could not fetch data from url " + GRAPH_QUERY_URL));
              }
            });
        } else {
          //Data could not be loaded:
          var err_msg="Could not fetch data from url " + userProfileURL + ", username maybe invalid.";
          res.json(createErrorResponse("INVALID_USERNAME",err_msg));
        }
      });
  } else {
    res.json(createErrorResponse("INVALID_QUERY","Invalid Query at /getProfileData"));
  }
});

/**
 * Middleware to be used at last to hande invalid requests made to server
 * If a request is made to the server for which an endpoint has not been defined, then this middleware displays an error text.
 */
app.use(function(req, res, next) {
  res.send("Error.....!!!!");
});

//Start server
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

/**
 * Creates an error_respone object that can be used to return error information as json.
 */
function createErrorResponse(error_code, error_message) {
  var error_respone = {
    error : {
      code: error_code,
      message: error_message
    }
  };
  return error_respone;
}
