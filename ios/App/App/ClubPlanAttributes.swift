import ActivityKit
import Foundation

@available(iOS 16.2, *)
struct ClubPlanAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var start: Date
        var end: Date
    }
    var eventID: String
}
