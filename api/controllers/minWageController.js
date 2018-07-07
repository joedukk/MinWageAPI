'use strict';

var moment = require('moment');
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

exports.minWages_basic_report = (req, res) => {
    if (!req.isAuthenticated()) {
        res.redirect('/login');
    } else {
        var xl = require('excel4node');

        const mapCounties = req.query.mapCounties && req.query.mapCounties.toLowerCase() === 'true';

        minWageService.getMinWage(mapCounties, minWages => {
            var dt = new moment();
            var wb = new xl.Workbook();
            var ws = wb.addWorksheet(`Min Wage Data ${dt.format('MMMM')} ${dt.format('YY')}`);

            // Create a reusable style
            var style = wb.createStyle({
                font: {
                    size: 12
                },
                numberFormat: '$#,##0.00; ($#,##0.00); -'
            });

            ws.cell(1, 1).string('State').style(style);
            ws.cell(1, 2).string('Locality').style(style);
            ws.cell(1, 3).string('Minimum Wage').style(style);

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
                ws.cell(currentRow, 1).string(data.state).style(style);
                if (data.locality) {
                    ws.cell(currentRow, 2).string(data.locality).style(style);
                }
                ws.cell(currentRow, 3).number(data.minWage).style(style);
            })

            wb.write('MinWageData.xlsx', res);
        });
    }
}