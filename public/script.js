//config variables
const GET_PROFILE_DATA_URL = "/getProfileData";
const TOP_POSTS_MAX_LENGTH = 5;
// sample ig_post_link = https://www.instagram.com/p/BUHuf-Gg1qc/?taken-by=vijitdhingra
const IG_POST_LINK_BASE_URL = "https://www.instagram.com/p/";

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
  //console.log("..fetching profile data for " + ig_username);
  //hiding previously displayed content
  $("#profile_area").hide();
  $("#unknown_error_message_area").hide();
  //showing loader
  $("#loading_message_area").show();
  //fetching instagram profile data through ajax GET request
  $.ajax({
    url: GET_PROFILE_DATA_URL,
    data: {
      "ig_username": ig_username,
    },
    method: "GET",
    dataType: "json",
    success: function(result) {
      //hiding loader
      $("#loading_message_area").hide();
      //console.log("data fetched Successfully from url: " + GET_PROFILE_DATA_URL);
      //console.log(result);
      if (result.error) {
        //console.log(result.error);
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
      //hiding loader
      $("#loading_message_area").hide();
      var err_msg = "data could not be fetched from url: " + GET_PROFILE_DATA_URL;
      //console.log(err_msg);
      displayUnknownErrorMessage(err_msg);
    }
  });
}

/*
Hides #profile_area and shows #unknown_error_message_area with the appropriate error message.
*/
function displayUnknownErrorMessage(error_message) {
  //hiding #profile_area
  $("#profile_area").hide();
  $("#unknown_error_message_area").show();
  $("#unknown_error_message_area .info-text").html("Something unexpected happened. Try again. If the error persists send a screenshot to my <a href='mailto:vijitdhingra@gmail.com'>email</a> so that I can check what's wrong. </br> Error Message: " + error_message);
}

/*
Hides #unknown_error_message_area and shows #profile_area with the relevant information
*/
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
    $("#stats_source_msg").html("*Stats based on your last " + profile_data.stats.posts_scanned + " posts");
    $("#stats_average_likes").html("Average likes per post: <strong>" + Math.round(profile_data.stats.average_likes) + "</strong>");
    $("#stats_top_posts_msg").html("Your top " + profile_data.stats.top_posts.length + " posts")
    $(".top_posts_container").html("");
    var i;
    for (i = profile_data.stats.top_posts.length - 1; i >= 0; --i) {
      var post = profile_data.stats.top_posts[i];
      var ig_post_link = IG_POST_LINK_BASE_URL + post.shortcode + "/?taken-by=" + profile_data.user_info.username;
      if (post.is_video) {
        $(".top_posts_container").append("<div class='col-xs-4'><div class='thumbnail'><a href='" + ig_post_link + "' target='_blank'><img src='" + post.thumbnail_src + "'></a><span class='glyphicon glyphicon-play-circle video-icon'></span><div class='caption'><p><b>" + post.edge_media_preview_like.count + "</b> likes</p></div></div></div>");
      } else {
        $(".top_posts_container").append("<div class='col-xs-4'><div class='thumbnail'><a href='" + ig_post_link + "' target='_blank'><img src='" + post.thumbnail_src + "'></a><div class='caption'><p><b>" + post.edge_media_preview_like.count + "</b> likes</p></div></div></div>");
      }
    }
    drawLikesChart();
  }
}

/*
Adds content to #profile_information_area based on profile_data.
Assumes #profile_information_area is visible and profile_data contains appropriate information.
*/
function addContentToProfileInformationArea() {
  $("#profile_photo").attr('src', profile_data.user_info.profile_pic_url);
  $("#profile_full_name").html(profile_data.user_info.full_name);
  $("#profile_posts").html("posts: <strong>" + profile_data.user_info.total_posts + "</strong>");
  $("#profile_followers").html("followers: <strong>" + profile_data.user_info.followers + "</strong>");
  $("#profile_following").html("following: <strong>" + profile_data.user_info.following + "</strong>");
}

/*
Plays with raw_profile_data and populates profile_data which contains user information and generated stats.
*/
function playWithRawProfileData() {
  var raw_posts_data = raw_profile_data.user_media.data.user.edge_owner_to_timeline_media;
  var raw_user_information = raw_profile_data.user_details.user;
  var user_information = {};
  //extracting important user information from raw_profile_data.
  user_information.username = raw_user_information.username;
  user_information.full_name = raw_user_information.full_name;
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
  //console.log("Profile Stats: ");
  //console.log(profile_data);
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
    },
    backgroundColor: "#FAFAFA"
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
