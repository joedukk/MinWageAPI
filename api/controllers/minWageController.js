'use strict';

var minWageService = require('../services/minWageService');

exports.list_all_minWages = (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/login');
    } else {
        const mapCounties = req.query.mapCounties && req.query.mapCounties.toLowerCase() === 'true';
    
        minWageService.getMinWage(mapCounties, minWages => {
            res.json(minWages);
        });
    }
};
