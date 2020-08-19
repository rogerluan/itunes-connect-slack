const poster = require("./post-update.js")
const dirty = require("dirty")
const db = dirty("kvstore.db")
const debug = false
const pollIntervalSeconds = process.env.POLL_TIME_IN_SECONDS

function checkAppStatus() {
    console.log("Fetching latest app status...")
    // Invoke ruby script to grab latest app status
    const exec = require("child_process").exec
    exec("ruby get-app-status.rb", function(err, stdout, stderr) {
        if (stdout) {
            // Compare new app info with last one (from database)
            console.log(stdout)
            const versions = JSON.parse(stdout)
            for (let version of versions) {
                _checkAppStatus(version)
            }
        } else {
            console.log("There was a problem fetching the status of the app!")
            console.log(stderr)
        }
    })
}

function _checkAppStatus(version) {
    // Use the live version if edit version is unavailable
    const currentAppInfo = version["editVersion"] ? version["editVersion"] : version["liveVersion"]
    const appInfoKey = "appInfo-" + currentAppInfo.appId
    const submissionStartkey = "submissionStart" + currentAppInfo.appId
    const lastAppInfo = db.get(appInfoKey)
    if (!lastAppInfo || lastAppInfo.status != currentAppInfo.status || debug) {
        poster.slack(currentAppInfo, db.get(submissionStartkey))

        // Store submission start time
        if (currentAppInfo.status == "Waiting For Review") {
            db.set(submissionStartkey, new Date())
        }
    } else if (currentAppInfo) {
        console.log(`Current status "${currentAppInfo.status}" matches previous status. AppName: "${currentAppInfo.name}"`)
    } else {
        console.log("Could not fetch app status")
    }

    // Store latest app info in database
    db.set(appInfoKey, currentAppInfo)
}

if (!pollIntervalSeconds) {
    pollIntervalSeconds = 60 * 2
}

setInterval(checkAppStatus, pollIntervalSeconds * 1000)
checkAppStatus()
