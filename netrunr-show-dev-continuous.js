/*
 * Example program - Show connected BLE devices - continuous mode
 *
 * Copyright(C) 2020 Axiomware Systems Inc..
 * https://www.axiomware.com/
 *
 * Licensed under the MIT license <LICENSE-MIT or http://opensource.org/licenses/MIT>
 */

'use strict'

const minimist = require('minimist')
const gapiV3Lib = require('gapi-v3-sdk')
const fs = require('fs')
const path = require('path')

process.stdin.resume() // so the program will not close instantly

process.on('exit', function (err) { // On exit handler
  console.log('Goodbye!')
})

process.on('unhandledRejection', (reason, p) => { // Unhandled promise rejections.
  console.log('Unhandled Rejection at: Promise', p)
  // application specific handling here
})

process.on('uncaughtException', (reason, p) => { // Unhandled exceptions
  console.log(p, 'reason:', reason)
  // application specific handling here
})

const args = minimist(process.argv.slice(2), {
  string: ['host', // MQTT broker IP addr
    'port', // MQTT broker port
    'prefix', // Topic prefix
    'ca-filename', // Root CA file name
    'key-filename', // client key
    'crt-filename' // client certificate
  ],
  boolean: ['tls'], // true -> if TLS is needed
  alias: { h: 'host', p: 'port', t: 'prefix' },
  default: {
    host: '192.168.8.1',
    port: '1883',
    prefix: 'netrunrfe/',
    tls: false,
    'ca-filename': '',
    'key-filename': '',
    'crt-filename': ''
  }
})

var CA = null
var KEY = null
var CRT = null

var gHostFE = args.host
var gPortFE = args.port
var gTLS = args.tls
if (gTLS) {
  if (args['ca-filename']) {
    const caFQN = path.isAbsolute(args['ca-filename']) ? args['ca-filename'] : path.join(__dirname, args['ca-filename'])
    try {
      CA = fs.readFileSync(caFQN)
    } catch (err) {
      console.log(`Error reading CA file [${caFQN}]`)
    }
  }
  if (args['key-filename']) {
    const keyFQN = path.isAbsolute(args['key-filename']) ? args['key-filename'] : path.join(__dirname, args['key-filename'])
    try {
      KEY = fs.readFileSync(keyFQN)
    } catch (err) {
      console.log(`Error reading KEY file [${keyFQN}]`)
    }
  }
  if (args['crt-filename']) {
    const crtFQN = path.isAbsolute(args['crt-filename']) ? args['crt-filename'] : path.join(__dirname, args['crt-filename'])
    try {
      CRT = fs.readFileSync(crtFQN)
    } catch (err) {
      console.log(`Error reading CRT file [${crtFQN}]`)
    }
  }
}

var gOptionsFE = {
  username: '',
  password: '',
  key: KEY,
  cert: CRT,
  ca: CA,
  rejectUnauthorized: false
}

var gTopicPrefixFE = args.prefix

var gwHandleList = []

const gNetrunrClient = new gapiV3Lib.GapiClient()
main()

async function main () {
  gNetrunrClient.on('heartbeat', gwHeartbeatHandler)
  await gNetrunrClient.init(gHostFE, gPortFE, gOptionsFE, gTopicPrefixFE, gTLS)
  await getGWinfo()
  setInterval(getGWinfo, 10000)
}

// get info from all gateways
async function getGWinfo () {
  const devInfo = []
  const gwlist = gNetrunrClient.listGW()

  // For each gateway, get version, ping and connected devices list
  await Promise.all(gwlist.map(async gw => {
    if (gNetrunrClient.getBleLinkStatus(gw.id)) {
      const ver = await gwHandleList[gw.id].version() // get version info
      const ping = await gwHandleList[gw.id].ping() // get ping round-trip-time
      const show = await gwHandleList[gw.id].show(5000) // get list of connected devices
      devInfo.push({ gwid: ping.gwid, version: ver.version, 'rtt(ms)': ping.rtt, nodes: JSON.stringify(show.nodes) })
    }
  }))

  // Use promise.all to wait until all async calls return and exit
  console.table(devInfo)
}

// Heartbeat handler
async function gwHeartbeatHandler (hbtData) {
  // console.log(`[${dateTime(hbtData.date)}][${hbtData.id}][${hbtData.rcount}]`)
  if (!gNetrunrClient.getBleLinkStatus(hbtData.id)) { // If not already connected, connect to gateway
    gwHandleList[hbtData.id] = await gNetrunrClient.createBleLink(hbtData.id).catch((err) => { console.log(`[${hbtData.id}]: Connection issues ${JSON.stringify(err)}`) })
  }
}
