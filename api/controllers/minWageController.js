'use strict';

var request = require('request');
var cheerio = require('cheerio');

var errors = [];

var parseLastIncrease = function (element, state, locality) {
    var lastIncreasePattern1 = /(.*)( to)(.*)(, effective )(.*)/;
    var lastIncreasePattern2 = /(.*)(, effective )(.*)/;

    var lastIncrease = null;
    var lastIncreaseRaw = element.children('td:nth-child(4)').text();
    if (lastIncreaseRaw) {
        var lastIncreaseMatches1 = lastIncreaseRaw.match(lastIncreasePattern1);
        var lastIncreaseMatches2 = lastIncreaseRaw.match(lastIncreasePattern2);
        if (lastIncreaseMatches1) {
            lastIncrease = {
                from: lastIncreaseMatches1[1],
                to: lastIncreaseMatches1[3],
                effective: lastIncreaseMatches1[5],
            }
        } else if (lastIncreaseMatches2) {
            lastIncrease = {
                to: lastIncreaseMatches2[1],
                effective: lastIncreaseMatches2[3],
            }
        } else {
            var error = `Could not parse upcoming increase for ${state} / ${locality}. '${lastIncreaseRaw}'`;
            console.error(error);
            errors.push(error);
        }
    }

    return lastIncrease;
}

var parseUpcomingIncrease = function (element, state, locality) {
    var upcomingIncreasePattern1 = /(.*)(?:, effective )(.*)(?:\*?)/;
    var upcomingIncreasePattern2 = /(.*)(?:, beginning )(.*)(?:\*?)/;

    var upcomingIncreases = [];
    var upcomingIncreasesRaw = element.children('td:nth-child(5)').text();
    if (upcomingIncreasesRaw) {
        var upcomingIncreasesArr = upcomingIncreasesRaw.split('/');
        var note = upcomingIncreasesArr[upcomingIncreasesArr.length - 1];
        var hasNote = note.indexOf('indexing') !== -1;

        upcomingIncreasesArr.forEach((upcomingIncrease, i) => {
            if (i === upcomingIncreasesArr.length - 1 && hasNote) {
                return;
            }

            var upcomingIncreaseMatches1 = upcomingIncrease.match(upcomingIncreasePattern1);
            var upcomingIncreaseMatches2 = upcomingIncrease.match(upcomingIncreasePattern2);

            // need to check for annual indexing footnote
            if (upcomingIncreaseMatches1) {
                upcomingIncreases.push({
                    to: upcomingIncreaseMatches1[1],
                    effective: upcomingIncreaseMatches1[2].trim(),
                    note: hasNote ? note : null
                });
            } else if (upcomingIncreaseMatches2) {
                upcomingIncreases.push({
                    to: upcomingIncreaseMatches2[1],
                    effective: upcomingIncreaseMatches2[2].trim(),
                    note: hasNote ? note : null
                });
            } else {
                var error = `Could not parse upcoming increase for ${state} / ${locality}. '${upcomingIncrease}'`;
                console.error(error);
                errors.push(error);
            }
        })
    }

    return upcomingIncreases;
}

exports.list_all_minWages = function (req, res) {
    request('https://www.epi.org/minimum-wage-tracker/#/min_wage/', function (error, response, html) {
        // First we'll check to make sure no errors occurred when making the request
        if (!error) {
            // Next, we'll utilize the cheerio library on the returned html which will essentially give us jQuery functionality

            var $ = cheerio.load(html);

            var dataTable = [];
            $('.data-table-wrapper > table > tbody > tr').each(function (index, element) {
                try {
                    var state = $(element).find('th').text().trim();
                    var locality = $(element).children('td:nth-child(2)').text().trim() || null;
                    var minWage = $(element).children('td:nth-child(3)').text();
                    var lastIncrease = parseLastIncrease($(element), state, locality);
                    var upcomingIncrease = parseUpcomingIncrease($(element), state, locality);
                    var indexing = $(element).children('td:nth-child(6)').text();
                    var lastChange = $(element).children('td:nth-child(7)').text();
                    var notes = $(element).children('td:nth-child(8)').text();

                    dataTable.push({
                        state,
                        locality,
                        minWage,
                        lastIncrease,
                        upcomingIncrease,
                        indexing,
                        lastChange,
                        notes
                    });
                } catch (err) {
                    console.error(err.message);
                    errors.push(`Error while processing ${(state + ' ' || '')}${(locality + ' ' || '')}${err.message}`);
                }
            })

            res.json({
                data: dataTable,
                errors
            });
        }
    })
};
