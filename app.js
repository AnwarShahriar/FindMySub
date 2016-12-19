#!/usr/bin/env node

var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

const PROVIDER_SUBSCENE = 'subscene';
const SUBSCENE_BASE_URL = 'https://subscene.com';
var currentDir = process.cwd();

var fileNames = fs.readdirSync(currentDir);
var eligibleFiles = fileNames.filter((name) => {
                                    name = name.toLowerCase();
                                    return name.endsWith('.mkv') ||
                                        name.endsWith('.mp4') ||
                                        name.endsWith('.mov') ||
                                        name.endsWith('.avi');   
                                });

if (!eligibleFiles) {
    process.exitCode = 1;
}
// todo: filter out the largest file as that one is the best guess for the movie file
var eligibleFile = eligibleFiles[0]; // Currently support one video file
var subsceneReqURL = SUBSCENE_BASE_URL + '/subtitles/release?q=' + eligibleFile;
request(subsceneReqURL, function(err, res, body) {
    if(!err && res.statusCode == 200) {
        var subtitles = extractSubtitles(body, PROVIDER_SUBSCENE);
        if (!subtitles) {
            console.log('No subtitle found');
            process.exitCode = 1;    
        }

        downloadSubtitle(subtitles, { lang: 'english' }, function(err, result) {
            if(!err) {
                console.log(result);
            } else {
                console.log(err.msg);
                process.exitCode = 1;
            }
        });
    } else {
        process.exitCode = 1;
    }
});

var extractSubtitles = function(html, provider) {
    if(provider === PROVIDER_SUBSCENE) {
        return extractSubtitlesFromSubscene(html);
    }

    return [];
};

var extractSubtitlesFromSubscene = function(html) {
    var $ = cheerio.load(html);
    var subtitles = [];
    $('.subtitles').find('tbody').find('tr').each(function(i, el) {
        var subLink = $(el).find('a')[0];
        var lang = $(subLink).find('.l').text();
        var link = $(subLink).attr('href');
        var title = $(subLink).find('span').not('.l').text();
        subtitles.push({
            lang: lang.toString().trim().toLowerCase(),
            link: link.toString().trim(),
            title: title.toString().trim()
        });
    });
    return subtitles;
}

var downloadSubtitle = function(subtitles, option, callback) {
    var lang = option.lang || 'english';
    lang = lang.toLowerCase();

    var filteredSubs = subtitles.filter((sub) => sub.lang === lang);
    
    if (!filteredSubs || filteredSubs.length == 0) {
        var errMsg = 'No subtitle found for "' + lang + '" language';
        callback({ msg: errMsg }, null);
        return;
    }

    var firstSub = filteredSubs[0];
    // todo: change implementation according to PROVIDER
    request(SUBSCENE_BASE_URL + firstSub.link, function(err, res, body) {
        if(err || res.statusCode != 200) {
            var errMsg = 'No subtitle found for "' + lang + '" language';
            callback({ msg: errMsg }, null);
            return;
        }

        $ = cheerio.load(body);
        var downloadLink = SUBSCENE_BASE_URL + $('#downloadButton').attr('href').toString();

        var extension;
        request(downloadLink)
            .on('error', function(err) {
                var errMsg = 'No subtitle found for "' + lang + '" language';
                callback({ msg: errMsg }, null);
            })
            .on('end', function() {
                callback(null, "Successfully downloaded subtitle");
            })
            .pipe(fs.createWriteStream('subtitle'));
    });
};