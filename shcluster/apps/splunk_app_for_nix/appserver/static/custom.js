unixcf = {};

unixcf.time_of_day = {
    dimension: function(d) { return d.date.getHours() + d.date.getMinutes() / 60; },
    group: Math.floor,
    x: function (dim, grp, params) { return d3.scale.linear().domain([0, 24]).rangeRound([0, params.barWidth * 24]); }
};

unixcf.by_host = {
    dimension: function(d) { 
        return d.hosts;
    },
    group: function(d) { 
        return d;
    }
};

unixcf.date = {
    dimension: function(d) { return d3.time.day(d.date); },
    x: function(dim, grp, params) {
        var span = 30,
            now = d3.time.day(new Date()),
            end = d3.time.day.offset(now, 1),
            start = d3.time.day.offset(now, 1 - span),
            bw = (params && params.barwidth) || 15;

        return d3.time.scale()
            .domain([start, end])
            .rangeRound([0, bw * span]);
    }
    //filter: [new Date(year, month, day - 7), new Date(year, month, day + 1)]
};

unixcf.by_name = {
    dimension: function(d) { return d.ss_name; }
};

unixcf.by_severity = {
    dimension: function(d) { return d.severity; }
};

unixcf.relativeTimeToEpoch = function(term) {
    var d = new Date();

    if (term === 'now')
        return d.getTime();
    else {
        var units = {'s' : 1, 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800},
            scale = units[term[term.length - 1]],
            delta = parseInt(term.slice(0, term.length-1), 10),
            diff = scale === undefined ? 0 : delta * scale * 1000,
            d = new Date();

        return d.getTime() + diff;
    }
};

unixcf.getTimeInterval = function (timerange) {
    var duration = timerange.getDuration() / 1000,
        latest = unixcf.relativeTimeToEpoch(timerange.getLatestTimeTerms()) + 1,
        earliest = latest - duration - 2,
        minutes = duration / 60,
        hours = duration / 3600,
        days = duration / 86400,
        weeks = duration / 604800;

    if (minutes <= 2) {
        return d3.time.second;
    } else if (hours <= 2) {
        return d3.time.minute;
    } else if (days <= 4) {
        return d3.time.hour;
    } else if (weeks <= 4) {
        return d3.time.day;
    } else if (weeks <= 12) {
        return d3.time.week;
    } else {
        return d3.time.month;
    }
};

unixcf.dyn_datetime = {
    dimension: function(d) {
        var params = unixcf.dyn_datetime.params;
        if (params === undefined || params.search === undefined) {
            return d3.time.day(d.date);
        } else {
            var interval = unixcf.getTimeInterval(params.search.getTimeRange());
            return interval.round(d.date);
        }
    },
    x: function(dim, grp) {
        var params = this.params,
            width = (params && params.width) || 300;

        if (params === undefined || params.search === undefined) {
            lt = new Date();
            et = new Date(lt.getTime() - 86400);
            inteval = d3.time.day;
        } else {
            var timerange = params.search.getTimeRange(),
                et = timerange.getEarliestTimeTerms(),
                lt = timerange.getLatestTimeTerms(),
                duration = timerange.getDuration();

            if (timerange.isAbsolute()) {
                et = new Date(et/1000);
                lt = new Date(lt/1000);
            } else if (timerange.isRelative()) {
                et = unixcf.relativeTimeToEpoch(et);
                lt = unixcf.relativeTimeToEpoch(lt);
            } else {
                et = dim.bottom(1)[0].date;
                lt = dim.top(1)[0].date;
            }

            interval = unixcf.getTimeInterval(timerange);
        }

        return d3.time.scale()
            .domain([et, lt])
            .nice(interval)
            .rangeRound([0, width]);
    }
};

