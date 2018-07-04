'use strict';
module.exports = function(app) {
  var minWageController = require('../controllers/minWageController');

  // todoList Routes
  app.route('/minWage')
    .get(minWageController.list_all_minWages)
};