import json
import logging
import os
import sys

import cherrypy
import splunk
import splunk.util

from splunk.appserver.mrsparkle.lib import jsonresponse
import controllers.module as module

logger = logging.getLogger('splunk')

class UnixBubbleGrid(module.ModuleHandler):

    def generateResults(self, **kwargs):

        field = kwargs.get('field')

        # return self.generateFromResult(**kwargs)

        if field is not None:
            logger.error("field set: %s" % field)
            return self.generateFromResult(**kwargs)
        else:
            logger.error("field not set: %s" % field)
            return self.generateFromResults(**kwargs)

    def rsFromSID(self, sid, entity_type):

        rs = None
        job = splunk.search.getJob(sid)
        #NIX-496 - Safari barfs when we populate a time scale with NaN 
        job.setFetchOption(output_time_format='%s')

        if entity_type.startswith('results_preview'):
            rs = job.results_preview
        else:
            rs = job.results

        return rs

    def generateFromResult(self, **kwargs):

        output = {'results': []} 
        sid = kwargs.get('sid')
        entity_type = kwargs.get('entity_type', 'results_preview')
        thr_min = float(kwargs.get('min', 100))
        thr_max = float(kwargs.get('max', 1000))
        dis_min = splunk.util.normalizeBoolean(kwargs.get('discard_min', False))
        dis_max = splunk.util.normalizeBoolean(kwargs.get('discard_max', False))
        
        thresholdify = None

        rs = self.rsFromSID(sid, entity_type)
         
        for idx, row in enumerate(rs):
            if thresholdify is None:
                ## Create header
                parser = SplunkBucketHeaderParser(row)
                threshold = Threshold(thr_min, thr_max)

                thresholdify = Thresholdify(parser, threshold)
                thresholdify.setDiscardMin(dis_min)
                thresholdify.setDiscardMax(dis_max)

                headers = thresholdify.createHeaderWithThreshold()
                output['results'].append(headers)
            else:
                ## Create bucket values
                newLine = []
                for column in thresholdify.parseDataLine(row):
                    newLine.append(column)
                output['results'].append(newLine)

        return output

    def generateFromResults(self, **kwargs):

        sid = kwargs.get('sid')
        count = max(int(kwargs.get('count', 10000)), 0)
        entity_type = kwargs.get('entity_type', 'results_preview')

        output = {'results': [], 'fields': {}, 'span': None}
        extent = {}
        range = [None, None] 
        span = None

        #rs = self.rsFromSID(sid, entity_type)
        rs = self.rsFromSID(sid, 'results')

        # enumerate data set
        for idx, row in enumerate(rs):
            # logger.error('ROW %s' % row);
            obj = {
                   'result': [], 
                   '_time': unicode(row['_time']) 
                  }
            if span is None:
                try:
                    span = int(unicode(row['_span']))
                except Exception, e:
                    logger.debug(e)
            for field in row:
                     
                if not field.startswith('_'):
                    try:
                        val = float(unicode(row[field]))
                        obj['result'].append(
                            [
                             unicode(field), 
                             val
                            ]
                        )
                        limits = extent.get(field)
                        if limits is None:
                            extent[field] = {'min': val, 'max': val}
                        else:
                            if val < limits['min']:
                                extent[field]['min'] = val
                            elif val > limits['max']:
                                extent[field]['max'] = val
                        if range[0] is None:
                            range[0] = val
                            range[1] = val
                        if val < range[0]:
                            range[0] = val
                        if val > range[1]:
                            range[1] = val
                    except Exception, e:
                        logger.debug(e)
            output['results'].append(obj)
        
        # can't have ranges with values of None
        if range[0] is None or range[1] is None:
            range = [0, 1]

        output['fields'] = extent
        output['range'] = range
        output['span'] = span

        return self.render_json(output)

    def render_json(self, response_data, set_mime='text/json'):
        cherrypy.response.headers['Content-Type'] = set_mime

        if isinstance(response_data, jsonresponse.JsonResponse):
            response = response_data.toJson().replace("</", "<\\/")
        else:
            response = json.dumps(response_data).replace("</", "<\\/")

        return ' ' * 256  + '\n' + response

class SplunkBucketHeaderParser():
    def __init__(self, headerLine):
        logger.error("bucket parser raw: %s" % headerLine)
        self.fields = [[], [], []]
        self.__parseAll__(headerLine)

    def getFieldsBefore(self):
        return self.fields[0]

    def getBucketFields(self):
        return self.fields[1]

    def getFieldsAfter(self):
        return self.fields[2]

    def __parseAll__(self, headerLine):
        for bucket in headerLine:
            if "-" in bucket:
                self.fields[1].append(bucket)
            elif len(self.fields[1]) > 0:
                self.fields[2].append(bucket)
            else:
                self.fields[0].append(bucket)


class Thresholdify():
    def __init__(self, splunkHeader, threshold):
        self.splunkHeader = splunkHeader
        self.threshold = threshold
        self.minBuckets = self.minBucketsToMerge()
        self.maxBuckets = self.maxBucketsToMerge()

        self.threshold = self.roundThreshold(threshold, self.getBucketsNotToMerge())
        self.discard_min = False
        self.discard_max = False

    def int_or_float(self, x):
        try:
            return int(x)
        except ValueError:
            return float(x)

    def roundThreshold(self, threshold, buckets):
        logger.error('threshold, buckets: %s %s' % (threshold, buckets))
        minThreshold = self.int_or_float(buckets[0].split("-")[0]) if (
            threshold.min > self.int_or_float(buckets[0].split("-")[0])) else threshold.min
        maxThreshold = self.int_or_float(buckets[-1].split("-")[1]) if (
            threshold.max < self.int_or_float(buckets[-1].split("-")[1])) else threshold.max

        return Threshold(minThreshold, maxThreshold)

    def minBucketsToMerge(self):
        result = 0
        for bucket in self.splunkHeader.getBucketFields():
            logger.error('bucket: %s' % bucket)
            upperLimit = bucket.split('-')[1]
            if self.int_or_float(upperLimit) <= self.threshold.min:
                result += 1

        return result

    def setDiscardMin(self, value):
        self.discard_min = value

    def setDiscardMax(self, value):
        self.discard_max = value

    def maxBucketsToMerge(self):
        result = 0
        for bucket in self.splunkHeader.getBucketFields():
            lowerLimit = bucket.split('-')[0]
            if self.int_or_float(lowerLimit) >= self.threshold.max:
                result += 1

        return result

    def getBucketsNotToMerge(self):
        return self.splunkHeader.getBucketFields()[
               self.minBuckets:(len(self.splunkHeader.getBucketFields()) - self.maxBuckets)]

    def createHeaderWithThreshold(self):
        result = []
        result.extend(self.splunkHeader.getFieldsBefore())

        if not self.discard_min:
            result.append("<" + str(self.threshold.min))

        result.extend(self.getBucketsNotToMerge())

        if not self.discard_max:
            result.append(">" + str(self.threshold.max))

        result.extend(self.splunkHeader.getFieldsAfter())

        return result

    def mergeBuckets(self, bucketsToMerge):
        result = 0
        for bucket in bucketsToMerge:
            result += self.int_or_float(bucket)
        return result

    def getMergedFields(self, bucketFields):
        result = []
        minMerge = self.mergeBuckets(bucketFields[0:self.minBuckets])
        maxMerge = self.mergeBuckets(bucketFields[(len(bucketFields) - self.maxBuckets):])

        if not self.discard_min:
            result.append(minMerge)

        for bucket in bucketFields[self.minBuckets:(len(bucketFields) - self.maxBuckets)]:
            result.append(self.int_or_float(bucket))

        if not self.discard_max:
            result.append(maxMerge)

        return result

    def getBeforeFieldsFromLine(self, line):
        return line[0:len(self.splunkHeader.getFieldsBefore())]

    def getBucketFieldsFromLine(self, line):
        return line[len(self.splunkHeader.getFieldsBefore()):(len(line) - len(self.splunkHeader.getFieldsAfter()))]

    def getAfterFieldsFromLine(self, line):
        return line[(len(line) - len(self.splunkHeader.getFieldsAfter())):]

    def parseDataLine(self, line):
        result = []
        result.extend(self.getBeforeFieldsFromLine(line))
        result.extend(self.getMergedFields(self.getBucketFieldsFromLine(line)))
        result.extend(self.getAfterFieldsFromLine(line))

        return result


class Threshold():
    def __init__(self, min, max):
        self.min = min
        self.max = max

