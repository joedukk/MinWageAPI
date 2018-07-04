'use strict';

var request = require('request');
var cheerio = require('cheerio');

var errors = [];

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
});

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
                from: +(lastIncreaseMatches1[1].replace('$', '')),
                to: +(lastIncreaseMatches1[3].replace('$', '')),
                effective: new Date(lastIncreaseMatches1[5]),
            }
        } else if (lastIncreaseMatches2) {
            lastIncrease = {
                to: +(lastIncreaseMatches2[1].replace('$', '')),
                effective: new Date(lastIncreaseMatches2[3]),
            }
        } else {
            var error = `Could not parse upcoming increase for ${state} / ${locality}. '${lastIncreaseRaw}'`;
            console.error(error);
            errors.push(error);
        }
    }

    return lastIncrease;
}

var parseUpcomingIncrease = function (element, state, locality, note) {
    var upcomingIncreasePattern1 = /(.*)(?:, effective )(.*)(?:\*?)/;
    var upcomingIncreasePattern2 = /(.*)(?:, beginning )(.*)(?:\*?)/;

    var upcomingIncreases = [];
    var upcomingIncreasesIndex = null;
    var upcomingIncreasesRaw = element.children('td:nth-child(5)').text();
    if (upcomingIncreasesRaw) {
        var upcomingIncreasesArr = upcomingIncreasesRaw.split('/');

        var lastIncrease = upcomingIncreasesArr[upcomingIncreasesArr.length - 1];
        var hasUpcomingIncreaseIndex = false;
        if (lastIncrease.indexOf('indexing') !== -1) {
            hasUpcomingIncreaseIndex = true;
            upcomingIncreasesIndex = note;
        }

        upcomingIncreasesArr.forEach((upcomingIncrease, i) => {
            if (hasUpcomingIncreaseIndex && i === upcomingIncreasesArr.length - 1) {
                return;
            }

            var upcomingIncreaseMatches1 = upcomingIncrease.match(upcomingIncreasePattern1);
            var upcomingIncreaseMatches2 = upcomingIncrease.match(upcomingIncreasePattern2);

            // need to check for annual indexing footnote
            if (upcomingIncreaseMatches1) {
                upcomingIncreases.push({
                    to: +(upcomingIncreaseMatches1[1].replace('$', '')),
                    effective: new Date(upcomingIncreaseMatches1[2].trim().replace('*', '')),
                    note: upcomingIncreaseMatches1[2].indexOf('*') !== -1 ? note.replace('*', '').trim() : null,
                });
            } else if (upcomingIncreaseMatches2) {
                upcomingIncreases.push({
                    to: +(upcomingIncreaseMatches2[1].replace('$', '')),
                    effective: new Date(upcomingIncreaseMatches2[2].trim().replace('*', '')),
                    note: upcomingIncreaseMatches2[2].indexOf('*') !== -1 ? note.replace('*', '').trim() : null,
                });
            } else {
                var error = `Could not parse upcoming increase for ${state} / ${locality}. '${upcomingIncrease}'`;
                console.error(error);
                errors.push(error);
            }
        })
    }

    return {
        upcomingIncreases,
        upcomingIncreasesIndex
    };
}

var getCountyMappings = async () => {
    const client = await pool.connect()
    const result = await client.query('SELECT * FROM epi_county_mapping');

    return result.rows;
}

exports.list_all_minWages = async (req, res) => {
    console.log(req.query.mapCounties);

    const countyMappings = await getCountyMappings();

    request('https://www.epi.org/minimum-wage-tracker/#/min_wage/', function (error, response, html) {
        // First we'll check to make sure no errors occurred when making the request
        if (!error) {
            // Next, we'll utilize the cheerio library on the returned html which will essentially give us jQuery functionality
            var $ = cheerio.load(html);

            var federalMinWage = 7.25;

            var dataTable = [];
            $('.data-table-wrapper > table > tbody > tr').each(function (index, element) {
                try {
                    var state = $(element).find('th').text().trim();
                    var locality = $(element).children('td:nth-child(2)').text().trim() || null;
                    var minWage = +$(element).children('td:nth-child(3)').text() || federalMinWage;
                    var lastIncrease = parseLastIncrease($(element), state, locality);
                    var note = $(element).children('td:nth-child(8)').text();
                    var upcomingIncrease = parseUpcomingIncrease($(element), state, locality, note);
                    var indexing = $(element).children('td:nth-child(6)').text();
                    var lastChange = $(element).children('td:nth-child(7)').text();

                    const data = [];

                    // map epi county mappings
                    const mappings = countyMappings.filter(countyMapping => countyMapping.state === state && countyMapping.locality === locality);
                    if (req.query.mapCounties && req.query.mapCounties.toLowerCase() === 'true' && mappings.length > 0) {
                        mappings.forEach(mapping => {
                            data.push({
                                state,
                                locality: mapping.alias,
                                minWage,
                                lastIncrease,
                                upcomingIncrease: !upcomingIncrease.upcomingIncreases || upcomingIncrease.upcomingIncreases.length === 0 ? null : upcomingIncrease.upcomingIncreases,
                                // upcomingIncreasesIndex: upcomingIncrease.upcomingIncreasesIndex.trim(),
                                indexing,
                                lastChange,
                            })
                        })
                    } else {
                        data.push({
                            state,
                            locality,
                            minWage,
                            lastIncrease,
                            upcomingIncrease: !upcomingIncrease.upcomingIncreases || upcomingIncrease.upcomingIncreases.length === 0 ? null : upcomingIncrease.upcomingIncreases,
                            // upcomingIncreasesIndex: upcomingIncrease.upcomingIncreasesIndex.trim(),
                            indexing,
                            lastChange,
                        });
                    }

                    dataTable.push(...data);
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
