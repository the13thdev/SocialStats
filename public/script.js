//config variables
const GET_PROFILE_DATA_URL = "/getProfileData";
const TOP_POSTS_MAX_LENGTH = 5;

//will hold the raw_profile_data for the latest username for which data has been fetched.
var raw_profile_data;

//will contain the profile information and profile stats generated after playing with raw_profile_data
var profile_data = {};

//loading google chart
google.charts.load('current', {
  packages: ['corechart', 'line']
});

//Callback for document ready
$(document).ready(function() {

});

//Callback for window resize
$(window).resize(function() {
  //To make the chart repsonsive
  if (profile_data.case == "STATS_AVAILABLE") {
    drawLikesChart();
  }
});

/*
Called on instagram username form submission.
Fetches the instagram profile data for username from server,
assigns value to raw_profile_data, and calls playWithRawProfileData() to generate stats if no error occured.
After required work is done, it calls one of displayStats() or displayUnknownErrorMessage().
*/
function fetchProfileData() {
  var ig_username = $('input[name=ig_username]').val();
  console.log("..fetching profile data for " + ig_username);
  //fetching instagram profile data through ajax GET request
  $.ajax({
    url: GET_PROFILE_DATA_URL,
    data: {
      "ig_username": ig_username,
    },
    method: "GET",
    dataType: "json",
    success: function(result) {
      console.log("data fetched Successfully from url: " + GET_PROFILE_DATA_URL);
      console.log(result);
      if (result.error) {
        console.log(result.error);
        if (result.error.code == "INVALID_USERNAME") {
          profile_data.case = "INVALID_USERNAME";
          displayStats();
        } else {
          displayUnknownErrorMessage(result.error.code + ", " + result.error.message)
        }
      } else {
        raw_profile_data = result;
        playWithRawProfileData();
        displayStats();
      }
    },
    error: function() {
      var err_msg = "data could not be fetched from url: " + GET_PROFILE_DATA_URL;
      console.log(err_msg);
      displayUnknownErrorMessage(err_msg);
    }
  });
}

function displayUnknownErrorMessage(error_message) {
  //hiding #profile_area
  $("#profile_area").hide();
  $("#unknown_error_message_area").show();
  $("#unknown_error_message_area .info-text").html("Uh oh! Something unexpected happened. </br> Error Message: " + error_message);
}

function displayStats() {
  //hiding #unknown_error_message_area
  $("#unknown_error_message_area").hide();
  //showing #profile_area
  $("#profile_area").show();
  //hiding all 3 #profile_information_area, #profile_error_area, and #profile_stats_area at first.
  $("#profile_information_area").hide();
  $("#profile_error_area").hide();
  $("#profile_stats_area").hide();
  if (profile_data.case == "INVALID_USERNAME") {
    $("#profile_error_area").show();
    $("#profile_error_area .info-text").html("You entered an invalid username.");
  } else if (profile_data.case == "NO_POSTS") {
    $("#profile_information_area").show();
    addContentToProfileInformationArea();
    $("#profile_error_area").show();
    $("#profile_error_area .info-text").html("You have no posts on Instagram, so we cannot provide any statistics.");
  } else if (profile_data.case == "PRIVATE_PROFILE") {
    $("#profile_information_area").show();
    addContentToProfileInformationArea();
    $("#profile_error_area").show();
    $("#profile_error_area .info-text").html("You have a private profile on instagram. Unfortunately, we cannot access data for a private profile. Try making your profile public and then using this.");
  } else {
    //case STATS_AVAILABLE
    $("#profile_information_area").show();
    addContentToProfileInformationArea();
    $("#profile_stats_area").show();
    drawLikesChart();
  }
}

/*
Adds content to #profile_information_area based on profile_data.
Assumes #profile_information_area is visible and profile_data contains appropriate information.
*/
function addContentToProfileInformationArea(){
  $("#profile_photo").attr('src',profile_data.user_info.profile_pic_url);
  $("#profile_full_name").html(profile_data.user_info.full_name);
  $("#profile_posts").html("posts: <b>"+profile_data.user_info.total_posts+"</b>");
  $("#profile_followers").html("followers: <b>"+profile_data.user_info.followers+"</b>");
  $("#profile_following").html("following: <b>"+profile_data.user_info.following+"</b>");
}

/*
Plays with raw_profile_data and populates profile_data
*/
function playWithRawProfileData() {
  var raw_posts_data = raw_profile_data.user_media.data.user.edge_owner_to_timeline_media;
  var raw_user_information = raw_profile_data.user_details.user;
  var user_information = {};
  //extracting important user information from raw_profile_data.
   user_information.full_name =  raw_user_information.full_name;
   user_information.profile_pic_url = raw_user_information.profile_pic_url;
   user_information.followers = raw_user_information.followed_by.count;
   user_information.following = raw_user_information.follows.count;
   user_information.total_posts = raw_user_information.media.count;
   //populating profile_data.user_info
   profile_data.user_info = user_information;
  //case when user has no posts
  if (raw_posts_data.count == 0) {
    profile_data.case = "NO_POSTS";
  }
  //case when user has some posts but they are not accessible because user has a private profile
  else if (raw_posts_data.edges.length == 0) {
    profile_data.case = "PRIVATE_PROFILE";
  }
  //case when user has some posts and profile is not private
  else {
    profile_data.case = "STATS_AVAILABLE";
    profile_stats = {};
    profile_stats.total_likes = 0;
    profile_stats.posts_scanned = raw_posts_data.edges.length;
    profile_stats.top_posts = [];
    profile_stats.chart_likes_rows = [];
    var i;
    //generating stats
    for (i = 0; i < raw_posts_data.edges.length; ++i) {
      var edge = raw_posts_data.edges[i];
      profile_stats.total_likes += edge.node.edge_media_preview_like.count;
      if (profile_stats.top_posts.length < TOP_POSTS_MAX_LENGTH) {
        profile_stats.top_posts.push(edge.node);
        profile_stats.top_posts.sort(comparePosts);
      } else if (profile_stats.top_posts[0].edge_media_preview_like.count < edge.node.edge_media_preview_like.count) {
        profile_stats.top_posts[0] = edge.node;
        profile_stats.top_posts.sort(comparePosts);
      }
      profile_stats.chart_likes_rows.push([new Date(parseInt(edge.node.taken_at_timestamp) * 1000), edge.node.edge_media_preview_like.count]);
    };
    profile_stats.average_likes = (profile_stats.total_likes / raw_posts_data.edges.length);
    profile_data.stats = profile_stats;
  }
  console.log("Profile Stats: ");
  console.log(profile_data);
}

/*
Draws the #chart_likes based on data profile_data.stats.chart_likes_rows, using google charts api.
Assumes <div> element with id #chart_likes exists and is visible.
*/
function drawLikesChart() {
  var data = new google.visualization.DataTable();
  data.addColumn('date', 'Date');
  data.addColumn('number', 'Likes');

  data.addRows(profile_data.stats.chart_likes_rows);

  var options = {
    hAxis: {
      title: 'Date'
    },
    vAxis: {
      title: 'Likes'
    }
  };

  var chart = new google.visualization.LineChart(document.getElementById('chart_likes'));
  chart.draw(data, options);
}

/*
Compares two posts based on their likes.
Posts are edge.node objects.
*/
function comparePosts(post1, post2) {
  return post1.edge_media_preview_like.count - post2.edge_media_preview_like.count;
}
