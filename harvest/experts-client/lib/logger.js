import bunyan from 'bunyan';
import path from 'path';
import fs from 'fs';
import { performance } from 'node:perf_hooks';

const streams = [
  // Log to the console

  { level: 'info', stream: process.stdout }

];

function markSerializer(mark) {
  if (mark && (typeof mark === 'string' || mark instanceof String)) {
    performance.mark(mark);
  }
  return mark;
}

function measureSerializer(measure) {
  if (!measure) {
    return measure;
  }
  const marks=Array.isArray(measure) ? measure : [measure];
  const measured =[];
  marks.forEach((mark) => {
      try {
        performance.measure(`__${mark}`,mark);
        measured.push({mark:mark, duration:Math.round(performance.getEntriesByName(`__${mark}`)[0].duration)});
        performance.clearMeasures(`__${mark}`);
      } catch (e) {
        measured.push({mark:mark,duration:null});
      }
    });
  return measured;
}

export const logger = bunyan.createLogger({
  name: 'experts',
  level: 'info',
  serializers: {
    mark: markSerializer,
    measure: measureSerializer,
    err: bunyan.stdSerializers.err,
    req: bunyan.stdSerializers.req,
    res: bunyan.stdSerializers.res
  },
  streams: streams,
});
