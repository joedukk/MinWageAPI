var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000;

const passport = require('passport');
const Auth0Strategy = require('passport-auth0');
const session = require('express-session');

// Configure Passport to use Auth0
const strategy = new Auth0Strategy(
  {
    domain: 'joedukk.auth0.com',
    clientID: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    callbackURL: process.env.AUTH0_CALLBACK_URL || 'http://localhost:5000/callback'
  },
  (accessToken, refreshToken, extraParams, profile, done) => {
    return done(null, profile);
  }
);

passport.use(strategy);

// This can be used to keep a smaller payload
passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// app.use(require('cookie-parser')());
// app.use(require('body-parser').urlencoded({ extended: true }));
app.use(session({ 
  secret: 'nodejs rocks',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

var routes = require('./api/routes/minWageRoutes'); //importing route
routes(app);

app.listen(port);
