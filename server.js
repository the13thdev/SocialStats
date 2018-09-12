//Importing modules
var express = require('express');
var morgan = require('morgan');
var request = require('request');
var path = require('path');
var crypto = require('crypto')

//data Variables
const IG_QUERY_HASH = "a5164aed103f24b03e7b7747a2d94e3c"
const HOMEPAGE_URL = "https://www.instagram.com/";
const GRAPH_QUERY_URL = "https://www.instagram.com/graphql/query/";
const NUMBER_OF_POSTS_TO_FETCH = 500;

// the header properties that stay same for all requests
presistent_header = {'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/604.3.5 (KHTML, like Gecko) Version/11.0.1 Safari/604.3.5'}

//initializing express
var app = express();

//setting port to listen on
app.set('port', (process.env.PORT || 5000));
//setting static public directory for public  css,js and html files.
app.use(express.static('public'))
//middleware for logging requests
app.use(morgan('dev'));

/**
 * Root endpoint. Sends index html file.
 */
app.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get('/getProfileData', function(req, res, next) {
  if (req.query.ig_username) {
    var userProfileURL = HOMEPAGE_URL + req.query.ig_username;
    request.get({
        url: userProfileURL,
        headers: presistent_header
      },
      function(error, response, body) {

        if (!error && response.statusCode == 200) {
          //Data Successfully loaded
          console.log("data fetched Successfully from url " + userProfileURL);
          var response_data = {};
          shared_data = JSON.parse(body.match(new RegExp("window._sharedData =(.*?);</script>"))[1]);
          response_data.user_details = shared_data.entry_data.ProfilePage[0]
          user_id = response_data.user_details.graphql.user.id;
          csrf_token = shared_data.config.csrf_token
          rhx_gis =  shared_data.rhx_gis
          console.log("csrf_token from html: "+csrf_token)
          console.log("rhx_gis: "+rhx_gis)
          console.log("..user_id is " + user_id);
          
          query_variables = JSON.stringify({
            "id": user_id,
            "first": NUMBER_OF_POSTS_TO_FETCH
          })

          request_signature = generateRequestSignature(rhx_gis, query_variables)
          console.log("generated req signature is : "+request_signature)

          request.get({
              url: GRAPH_QUERY_URL,
              headers: Object.assign({'X-Instagram-GIS': request_signature}, presistent_header),
              qs: {
                "query_hash": IG_QUERY_HASH,
                "variables": query_variables
              }
            },
            function(error, response, body) {
              if (!error && response.statusCode == 200) {
                console.log("data fetched Successfully from graph query url");
                response_data.user_media = JSON.parse(body);
                res.json(response_data);
              } else {
                res.json(createErrorResponse("GRAPH_QUERY_ERROR", "Could not fetch data from url " + GRAPH_QUERY_URL + ", return response code = " + response.statusCode));
              }
            });
        } else {
          //Data could not be loaded:
          var err_msg = "Could not fetch data from url " + userProfileURL + ", username maybe invalid.";
          res.json(createErrorResponse("INVALID_USERNAME", err_msg));
        }
      });
  } else {
    res.json(createErrorResponse("INVALID_QUERY", "Invalid Query at /getProfileData"));
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
 * Generates the X-Instagram-GIS header value which is a md5 hash of `${rhxGis}:${queryVariables}`.
 * 
 * @param {string} rhxGis 
 * The value of rhxGis extracted from the html code.
 * @param {object} queryVariables 
 * The query variables object that will be sent in the request.
 */
function generateRequestSignature(rhxGis, queryVariables){
  return crypto.createHash('md5').update(`${rhxGis}:${queryVariables}`, 'utf8').digest("hex");
}

/**
 * Creates an error_respone object that can be used to return error information as json.
 * 
 * @param {string} error_code 
 * Error code string.
 * @param {string} error_message 
 * Error description.
 */
function createErrorResponse(error_code, error_message) {
  var error_respone = {
    error: {
      code: error_code,
      message: error_message
    }
  };
  return error_respone;
}
