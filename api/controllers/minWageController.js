'use strict';

var moment = require('moment');
var minWageService = require('../services/minWageService');
var orderBy = require('lodash/orderBy');

exports.list_all_minWages = (req, res) => {
    if (!req.isAuthenticated()) {
        req.session.redirectTo = `${req.originalUrl}${(qs ? `?${qs}` : '')}`;
        res.redirect('/login');
    } else {
        const mapCounties = req.query.mapCounties && req.query.mapCounties.toLowerCase() === 'true';

        minWageService.getMinWage(mapCounties, minWages => {
            res.json(minWages);
        });
    }
};

exports.minWages_basic_report = (req, res) => {
    if (!req.isAuthenticated()) {
        const qs = require('url').parse(req.url).query;
        req.session.redirectTo = `${req.originalUrl}${(qs ? `?${qs}` : '')}`;
        res.redirect('/login');
    } else {
        var xl = require('excel4node');
        var fs = require('fs');
        var statesRefData = JSON.parse(fs.readFileSync('./data/states.json', 'utf8'));

        const mapCounties = req.query.mapCounties && req.query.mapCounties.toLowerCase() === 'true';

        minWageService.getMinWage(mapCounties, minWages => {
            var dt = new moment();
            var wb = new xl.Workbook();
            var ws = wb.addWorksheet(`Min Wage Data ${dt.format('MMMM')} ${dt.format('YY')}`);

            var baseStyle = wb.createStyle({
                font: {
                    size: 12
                },
                numberFormat: '$#,##0.00; ($#,##0.00); -'
            });
            var dateStyle = wb.createStyle({
                font: {
                    size: 12
                },
                numberFormat: 'm/d/yyyy'
            });

            ws.cell(1, 1).string('State').style(baseStyle);
            ws.cell(1, 2).string('State Abbreviation').style(baseStyle);
            ws.cell(1, 3).string('Locality').style(baseStyle);
            ws.cell(1, 4).string('Current Minimum Wage').style(baseStyle);
            ws.cell(1, 5).string('Next Upcoming').style(baseStyle);
            ws.cell(1, 6).string('Effective Date').style(baseStyle);

            var currentState = null;
            var headerOffset = 2;
            var groupStart = 1;
            minWages.data.forEach((data, i) => {
                var currentRow = i + headerOffset;

                // // grouping logic. cant get it to group past 1 row...
                // if (currentState !== data.state) {

                //     if (currentRow - groupStart  > 1) {
                //         console.log(currentState, groupStart, currentRow);
                //         ws.row(groupStart).group(1, false);
                //     }

                //     currentState = data.state;
                //     groupStart = currentRow;
                // }
                ws.cell(currentRow, 1).string(data.state).style(baseStyle);

                if (data.state !== 'Federal') {
                    const state = statesRefData.find(state => state.name.toLowerCase() === data.state.toLowerCase());
                    if (state === undefined) {
                        throw (`Unable to locate abbreviation for ${data.state}`);
                    }

                    const abbreviation = state.abbreviation;
                    ws.cell(currentRow, 2).string(abbreviation).style(baseStyle);
                }

                if (data.locality) {
                    ws.cell(currentRow, 3).string(data.locality).style(baseStyle);
                }

                ws.cell(currentRow, 4).number(data.minWage).style(baseStyle);

                if (data.upcomingIncrease && data.upcomingIncrease.length > 0) {
                    const upcomingIncreases = orderBy([...data.upcomingIncrease], 'effective');
                    const nextIncrease = upcomingIncreases[0];
                    ws.cell(currentRow, 5).number(nextIncrease.to).style(baseStyle);
                    if (nextIncrease) {
                        ws.cell(currentRow, 6).date(moment(nextIncrease.effective).toDate()).style(dateStyle);
                    }
                }
            })

            wb.write('MinWageData.xlsx', res);
        });
    }
}