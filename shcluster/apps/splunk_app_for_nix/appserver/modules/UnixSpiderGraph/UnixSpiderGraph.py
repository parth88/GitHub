import json
import logging
import os
import sys
from sets import Set

import cherrypy
import controllers.module as module
import splunk
import splunk.search
import splunk.util
import lib.util as util
from splunk.appserver.mrsparkle.lib import jsonresponse

logger = logging.getLogger("splunk")

class UnixSpiderGraph(module.ModuleHandler):
    def generateResults(self, host_app, client_app, sid, aggregate, aggregateSize,fields={}, entity_name='results'):
        rows = []
        groupedData = {}
        max = 0
        min = 0

        if isinstance(fields, basestring):
            fields = json.loads(fields)

        if(('metricName' in fields and 'groupName' in fields and 'itemName' in fields)):
            job = splunk.search.JobLite(sid)
            res = job.getResults(entity_name)

            data = res.results()

            itemKey = fields.get('itemName')
            metricKey = fields.get('metricName')
            groupKey = fields.get('groupName')

        else:
            joblite = splunk.search.JobLite(sid)
            res = joblite.getResults(entity_name)
            data = res.results()

            fieldNames = [x for x in res.fieldOrder() if (not x.startswith('_'))]

            try:
                metricKey = unicode(fieldNames[2])
                groupKey = unicode(fieldNames[1])
                itemKey = unicode(fieldNames[0])
            except IndexError:
                return self.render_json({
                    "error": "incorrect fields",
                    "fields": fieldNames
                })

        # We need to output data keyed by group
        # that way we can represent the data within groups in the spidergraph
        groups = self.getUnique(groupKey, data)
        groups.sort()
        for group in groups:
            groupedData[group] = {}

        data = self.resultToArray(data)
        # logger.info("aggregate? %s" % aggregate)
        # json.loads is just used to parse to a boolean python understands
        # it is ordinarily just a string
        if(json.loads(aggregate)):
            aggregateSize = int(aggregateSize)
            data = self.aggregate(data, itemKey, metricKey, aggregateSize)
        
        for i, row in enumerate(data):
            group = unicode(row.get(groupKey))
            metric = float(unicode(row.get(metricKey, 0)))
            item = unicode(row.get(itemKey))

            currentData = {
                "metric": metric,
                "name": item
            }

            if metric > max:
                max = metric
            if metric < min:
                min = metric

            if item not in groupedData[group]:
                groupedData[group][item] = currentData

        data = {
            'groupedConverted': self.convertToArray(groupedData),
            'max': max,
            'min': min
        }

        return self.render_json(data)

    def render_json(self, response_data, set_mime="text/json"):
        cherrypy.response.headers["Content-Type"] = set_mime
        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")
        return " " * 256  + "\n" + response

    def resultToArray(self, resultSet):
        data = []
        for i, row in enumerate(resultSet):
            data.append({})
            for field in row:
                data[i][field] = row.get(field)

        return data

    def getUnique(self, key, data):
        unique = Set()

        for i, row in enumerate(data):
            val = unicode(row.get(key))
            if val not in unique:
                unique.add(val)

        return list(unique)

    # refactor me? rename?
    def convertToArray(self, groupedData):
        converted = []
        for k, group in groupedData.iteritems():
            itemData = []

            for item in group:
                itemData.append(group.get(item))

            converted.append({
                    "name": k,
                    "data": itemData
                })

        return converted

    def shouldAggregate(self, data, aggregateOn):
        clusters = self.getUnique(aggregateOn, data)

    # Aggregates data from a categorical field
    # Finds all the unique values from that field
    # then assigns subsets to our target number of fields
    # So if we had 4 fields but only wanted 2 clusters
    # there would be 2 original fields assigned per cluster
    # 
    # Each row takes on the average of the metric. The average
    # is taken across all the rows that use the same cluster field.
    def aggregate(self, data, aggregateOn, metricKey, numClusters=8):
        # collect the metric info 
        # so we can average it later
        metricInfo = {}

        # data format will be the same as the input
        # except the fields we are clustering on will hvae their values changed
        # to match the target numClusters
        originalClusters = self.getUnique(aggregateOn, data)

        # we want to round up so we don't miss anything
        # rounding down would leave us with remainders
        clusterSize = int(round(len(originalClusters) / float(numClusters)))
        
        clusterLookup = {}

        for i in range(numClusters):
            newKey = "aggregate-%s-%i" % (aggregateOn, i)
            metricInfo[newKey] = []

            for x in originalClusters[i*clusterSize : i*clusterSize+clusterSize]:
                clusterLookup[x] = newKey

        # logger.info("cluster size %i" % clusterSize)
        # logger.info("cluster lookup: %s" % clusterLookup)
        # logger.info("cluster lookup size, %i" % len(clusterLookup.keys()))
        # logger.info("original clusters: %s" % originalClusters)
        # logger.info("original cluster size %i" % len(originalClusters))

        for row in data:
            clusterVal = clusterLookup[str(row.get(aggregateOn))]
            row[aggregateOn] = clusterVal
            metricInfo[clusterVal].append(float(unicode(row.get(metricKey))))

        # compute the average of the metric field
        for row in data:
            vals = metricInfo[row.get(aggregateOn)]
            # logger.info('vals: %s' % vals)
            avg = sum(vals) / len(vals)
            row[metricKey] = avg

        # logger.info('new data (first row): %s' % data[0])

        return data


