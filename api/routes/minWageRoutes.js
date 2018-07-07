'use strict';

const passport = require('passport');

module.exports = function (app) {

  var minWageController = require('../controllers/minWageController');

  app.route('/')
    .get((req, res) => {
      res.redirect('/minWage');
    })

  app.route('/minWage')
    .get(minWageController.list_all_minWages);

  app.route('/report/minWage')
    .get(minWageController.minWages_basic_report);


  app.get('/callback',
    passport.authenticate('auth0', { failureRedirect: '/login' }),
    function (req, res) {
      if (!req.user) {
        throw new Error('user null');
      }
      res.redirect("/minWage");
    }
  );

  app.get('/login',
    passport.authenticate('auth0', {}), function (req, res) {
      res.redirect("/");
    });
};