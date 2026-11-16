import XCTest

// Run against the installed simulator app, never a phone with a real ride.
final class RideOrientationUITests: XCTestCase {
    private let app = XCUIApplication(bundleIdentifier: "live.outofsight.app")
    private var endRide: XCUIElement { app.buttons["End Ride and return to the main app"] }

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launchEnvironment["OOS_DEVELOPMENT_MEMBERSHIP"] = "pro"
        app.launch()
        let ready = NSPredicate { [app] _, _ in
            app.buttons["Start Ride"].exists || app.buttons["Resume Ride"].exists
        }
        expectation(for: ready, evaluatedWith: app)
        waitForExpectations(timeout: 45)
        let later = app.buttons["Not now"]
        if later.waitForExistence(timeout: 5) { later.tap() }
        if app.buttons["Resume Ride"].exists {
            app.buttons["Resume Ride"].tap()
            XCTAssertTrue(endRide.waitForExistence(timeout: 20))
            endRide.tap()
            XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 20))
            app.buttons["Done"].tap()
        }
        XCTAssertTrue(app.buttons["Start Ride"].waitForExistence(timeout: 15))
    }

    private func expectLandscape(_ landscape: Bool, _ message: String) {
        print("ORIENTATION \(message): expected landscape=\(landscape), window=\(app.windows.firstMatch.frame), state=\(app.state.rawValue)")
        let orientation = NSPredicate { [app] _, _ in
            let size = app.windows.firstMatch.frame.size
            return size.width > 0 && size.height > 0 && (size.width > size.height) == landscape
        }
        expectation(for: orientation, evaluatedWith: app)
        waitForExpectations(timeout: 12)
        XCTAssertEqual(app.windows.firstMatch.frame.width > app.windows.firstMatch.frame.height,
                       landscape, message)
    }

    private func startRide() {
        let ready = NSPredicate { [app] _, _ in
            let button = app.buttons["Start Ride"]
            return button.isHittable && app.windows.firstMatch.frame.contains(button.frame)
        }
        expectation(for: ready, evaluatedWith: app)
        waitForExpectations(timeout: 12)
        app.buttons["Start Ride"].tap()
        if app.staticTexts["Record your ride"].waitForExistence(timeout: 3) {
            app.buttons["Start Ride"].tap()
        }
        XCTAssertTrue(endRide.waitForExistence(timeout: 45))
    }

    private func recordScreenshot(_ name: String) {
        let image = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        image.name = name
        image.lifetime = .keepAlways
        add(image)
    }

    private func exerciseLock(opening: UIDeviceOrientation, landscape: Bool) {
        XCUIDevice.shared.orientation = opening
        expectLandscape(landscape, "Home follows rotation before entering Ride")
        startRide()
        expectLandscape(landscape, "Ride opens in the current orientation")

        XCUIDevice.shared.orientation = landscape ? .portrait : .landscapeLeft
        // Give UIKit time to deliver a rotation that must be refused.
        Thread.sleep(forTimeInterval: 2)
        expectLandscape(landscape, "Ride keeps its opening orientation")
        XCTAssertTrue(endRide.isHittable)

        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(endRide.waitForExistence(timeout: 10))
        recordScreenshot("resumed-\(opening.rawValue)")
        expectLandscape(landscape, "Returning to the app preserves the same lock")
        recordScreenshot("locked-\(opening.rawValue)")

        let home = app.links["Home, keep ride active"]
        XCTAssertTrue(home.waitForExistence(timeout: 15))
        home.tap()
        XCTAssertTrue(app.buttons["Resume Ride"].waitForExistence(timeout: 15))
        expectLandscape(!landscape, "Leaving Ride restores rotation while recording continues")
        app.buttons["Resume Ride"].tap()
        XCTAssertTrue(endRide.waitForExistence(timeout: 15))
        expectLandscape(!landscape, "Reopening Ride captures its new orientation")

        XCUIDevice.shared.orientation = opening
        Thread.sleep(forTimeInterval: 2)
        expectLandscape(!landscape, "The new orientation stays locked too")
        endRide.tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 20))
        expectLandscape(landscape, "Ending the ride restores rotation for the summary")
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Start Ride"].waitForExistence(timeout: 15))
    }

    func testPortraitLock() { exerciseLock(opening: .portrait, landscape: false) }
    func testLandscapeLeftLock() { exerciseLock(opening: .landscapeLeft, landscape: true) }
    func testLandscapeRightLock() { exerciseLock(opening: .landscapeRight, landscape: true) }

    func testLockButton() {
        startRide()
        // WebKit exposes aria-pressed buttons as toggles on newer iOS.
        let unlock = app.descendants(matching: .any).matching(identifier: "Unlock screen rotation").firstMatch
        let lock = app.descendants(matching: .any).matching(identifier: "Lock screen rotation").firstMatch
        XCTAssertTrue(unlock.waitForExistence(timeout: 10))
        unlock.tap()
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .landscapeLeft
        expectLandscape(true, "Unlocking allows rotation during the same recording")
        lock.tap()
        XCTAssertTrue(unlock.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 2)
        expectLandscape(true, "The button locks the newly selected landscape direction")
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(unlock.waitForExistence(timeout: 10))
        expectLandscape(true, "A manual lock survives app switching")
        unlock.tap()
        XCTAssertTrue(lock.waitForExistence(timeout: 10))
        expectLandscape(false, "Unlocking restores portrait without ending the ride")
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(lock.waitForExistence(timeout: 15))
        XCUIDevice.shared.orientation = .landscapeRight
        expectLandscape(true, "An unlocked ride remains unlocked after app switching")
        let home = app.links["Home, keep ride active"]
        XCTAssertTrue(home.waitForExistence(timeout: 15))
        home.tap()
        XCTAssertTrue(app.buttons["Resume Ride"].waitForExistence(timeout: 15))
        app.buttons["Resume Ride"].tap()
        XCTAssertTrue(unlock.waitForExistence(timeout: 15))
        XCUIDevice.shared.orientation = .portrait
        Thread.sleep(forTimeInterval: 2)
        expectLandscape(true, "Reentering Ride defaults to a fresh orientation lock")
        endRide.tap()
        XCTAssertTrue(app.buttons["Done"].waitForExistence(timeout: 20))
        expectLandscape(false, "Ending Ride restores normal rotation")
        app.buttons["Done"].tap()
        XCTAssertTrue(app.buttons["Start Ride"].waitForExistence(timeout: 15))
    }
}
