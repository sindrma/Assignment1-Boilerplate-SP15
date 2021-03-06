//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var fbgraph = require('fbgraphapi');
var mongoose = require('mongoose');
var app = express();
var me = {};
var me_likes = {};
var photoArr = {};

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
var INSTAGRAM_CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
var INSTAGRAM_CALLBACK_URL = process.env.INSTAGRAM_CALLBACK_URL;
var FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
var FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
var FACEBOOK_CALLBACK_URL = process.env.FACEBOOK_CALLBACK_URL;
var INSTAGRAM_ACCESS_TOKEN = "";
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);


//connect to database
mongoose.connect(process.env.MONGODB_CONNECTION_URL);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new FacebookStrategy({
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: FACEBOOK_CALLBACK_URL
    },
    function(accessToken, refreshToken, profile, done) {
        process.nextTick(function() {
            models.User.findOne({fb_id : profile.id}, function(err, user){
                if(user){
                    user.access_token_fb = accessToken;
                    user.save();
                    done(null,user);
                }else{
                    var newUser = new models.User({
                        fb_id : profile.id ,
                        name : profile.displayName,
                        access_token_fb : accessToken
                    }).save(function(err,newUser){
                            if(err) throw err;
                            done(null, newUser);
                        });
                }
            });

        });
  }
));

// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
      process.nextTick(function() {
          models.User.findOne({ig_id : profile.id}, function(err, user){
              if(user){
                  user.access_token_ig = accessToken;
                  user.save();
                  done(null,user);
              }else{
                  var newUser = new models.User({
                      ig_id : profile.id ,
                      username : profile.username,
                      ig_prof_pic : profile._json.data.profile_picture,
                      access_token_ig : accessToken
                  }).save(function(err, newUser){
                          if(err) throw err;
                          done(null, newUser);
                      });
              }
          });

      });
  }
));

//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(passport.initialize());
app.use(passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { 
    return next(); 
  }
  res.redirect('/login');
}

function ensureAuthenticatedInstagram(req, res, next) {
    if (req.isAuthenticated() && !req.user.access_token_fb) {
        return next();
    }
    res.redirect('/login');
}

//routes
app.get('/', function(req, res){
  res.render('login');
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
});

app.get('/facebook', ensureAuthenticated, function(req, res){
  var page=res;

  var fb = new fbgraph.Facebook(req.user.access_token_fb, 'v2.2');

  fb.graph('/me', function(err, res) {
    me = res;
    fb.graph('/me/likes', function(err, res){
      me_likes = res.data;
      fb.graph('/me/photos', function(err, res){
          photoArr = res.data.map(function (item) {
            tempJSON = {};
            tempJSON.source = item.images[2].source;
            if (item.name) {
              tempJSON.name = item.name;
            } else {
              tempJSON.name = "";
            }
            tempJSON.from = item.from.name;
            tempJSON.id = item.id;
            return tempJSON;
          });
        fb.graph('/me/feed', function(err, res){
          page.render('facebook', {user: me, likes: me_likes, photos: photoArr, latest_story:res.data[0].story});
        });
      });
    });
  });
});
app.get('/facebook_photos', ensureAuthenticated, function(req, res){
  var page=res;

  var fb = new fbgraph.Facebook(req.user.access_token_fb, 'v2.2');

  fb.graph('/me', function(err, res) {
    me = res;
      fb.graph('/me/photos', function(err, res){
        photoArr = res.data.map(function (item) {
          tempJSON = {};
          tempJSON.source = item.images[2].source;
          if (item.name) {
            tempJSON.name = item.name;
          } else {
            tempJSON.name = "";
          }
          tempJSON.from = item.from.name;
          tempJSON.id = item.id;
          return tempJSON;
        });
        page.render('facebook_photos', {user: me, photos: photoArr});
      });

  });
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', {user: req.user});
});

app.get('/instagram', ensureAuthenticatedInstagram, function(req, res){

  var query  = models.User.where({ username: req.user.username });
  query.findOne(function (err, user) {
    if (err) return handleError(err);
    if (user) {
      // doc may be null if no document matched

      Instagram.users.self({
        access_token: user.access_token_ig,
        complete: function(data) {
            var imageArr = data.map(function(item) {
              tempJSON = {};
            tempJSON.url = item.images.standard_resolution.url;
            if (item.caption) {
              tempJSON.caption = item.caption.text;
            } else {
              tempJSON.caption = "";
            }
              tempJSON.owner_name = item.user.username;
              tempJSON.owner_profile_pic = item.user.profile_picture;
            tempJSON.id = item.id;
            return tempJSON;
          });
          user._json = req.user._json;
          res.render('instagram', {photos: imageArr, user: req.user});
        }
      });





    }
  });
});

// GET /auth/instagram
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Instagram authentication will involve
//   redirecting the user to instagram.com.  After authorization, Instagram
//   will redirect the user back to this application at /auth/instagram/callback
app.get('/auth/instagram',
  passport.authenticate('instagram'),
  function(req, res){
    // The request will be redirected to Instagram for authentication, so this
    // function will not be called.
  });

// GET /auth/instagram/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', { failureRedirect: '/login'}),
  function(req, res) {
    res.redirect('/instagram');
  });

app.get('/auth/facebook',
    passport.authenticate('facebook', { scope: ['friends_birthday','read_stream', 'publish_actions', 'email', 'user_likes', 'user_friends', 'user_about_me', 'user_birthday','user_hometown','user_location','user_photos','public_profile'] })
);

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login'}),
    function(req, res) {
      res.redirect('/facebook');
    });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
