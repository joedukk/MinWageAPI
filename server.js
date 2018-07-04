var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000;

var routes = require('./api/routes/minWageRoutes'); //importing route
routes(app);

app.listen(port);
