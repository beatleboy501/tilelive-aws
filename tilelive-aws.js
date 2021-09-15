"use strict";

const { Buffer } = require("buffer");
const url = require("url");

const {
  Location
} = require("@aws-sdk/client-location");


module.exports = function (tilelive) {
  const client = new Location();

  // Usage: node_modules/.bin/tl copy -r tilelive-aws -z 0 -Z 2 aws:///assetTracker file://./tiles?filetype=mvt
  // npm install tl tilelive-file
  class AwsSource {
    constructor(uri, callback) {

      if (uri.path == null) {
        throw new Error("Usage: aws:///<MapResource>");
      }
      
      // aws:///MapName
      // this uses the path component rather than the host because URL normalization will downcase the host and resource names are case-sensitive
      this.mapName = uri.path.slice(1);

      return client.getMapStyleDescriptor({
        MapName: this.mapName
      }, (err, { Blob }) => {
        if (err) {
          return callback(err);
        }

        const style = JSON.parse(Buffer.from(Blob));
        const maxzoom = Object.values(style.sources).map(({ maxzoom }) => maxzoom).pop();

        this.info = {
          bounds: [-180, -85.0511, 180, 85.0511],
          minzoom: 0,
          maxzoom,
          // TODO support non-MVT sources (type !== "vector")
          format: "pbf",
        };

        return callback(null, this);
      });
    }

    async getTile(z, x, y, callback) {
      try {
        // for raster tiles, this will always fetch the 256x256 version
        const tile = await client.getMapTile({
          MapName: this.mapName,
          Z: z,
          X: x,
          Y: y,
        });

        return callback(null, Buffer.from(tile.Blob), {
          // TODO in future, tile contents may be compressed
          "Content-Encoding": "identity"
        });
      } catch (err) {
        console.log('ERROR');
        console.log(err);
        return callback(err);
      }
    }

    getInfo(callback) {
      return setImmediate(callback, null, this.info);
    }

    close(callback) {
      callback = callback || function () {};
      return callback();
    }
  }

  tilelive.protocols["aws:"] = AwsSource;

  return AwsSource;
};
