//
//  ViewController.swift
//  Shared (App)
//
//  Created by Junyi Hou on 18/6/25.
//

import WebKit
import os.log

#if os(iOS)
  import UIKit
  typealias PlatformViewController = UIViewController
#elseif os(macOS)
  import Cocoa
  import SafariServices
  typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "dev.junyi.PaperDebugger.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

  @IBOutlet var webView: WKWebView!

  override func viewDidLoad() {
    super.viewDidLoad()

    self.webView.navigationDelegate = self

    #if os(iOS)
      self.webView.scrollView.isScrollEnabled = false
    #endif

    self.webView.configuration.userContentController.add(self, name: "controller")

    self.webView.loadFileURL(
      Bundle.main.url(forResource: "Main", withExtension: "html")!,
      allowingReadAccessTo: Bundle.main.resourceURL!)
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    #if os(iOS)
      webView.evaluateJavaScript("show('ios')")
    #elseif os(macOS)
      webView.evaluateJavaScript("show('mac')")

      SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier)
      { (state, error) in
        guard let state = state, error == nil else {
          // Insert code to inform the user that something went wrong.
          return
        }

        DispatchQueue.main.async {
          if #available(macOS 13, *) {
            webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
          } else {
            webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
          }
        }
      }
    #endif
  }

  func userContentController(
    _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
  ) {
    #if os(iOS)
      print("message: \(message.body)")
      if message.body as! String == "open-preferences" {
        // iOS: 打开系统设置
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            print(settingsUrl)
          UIApplication.shared.open(settingsUrl) { success in
            if !success {
              // 如果打开失败，可以显示提示信息
              print("Failed to open settings")
            }
          }
        }
      }
    #elseif os(macOS)
      print("message: \(message.body)")
      if message.body as! String == "open-preferences" {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) {
          error in
          guard error == nil else {
            // Insert code to inform the user that something went wrong.
            return
          }
        }
      } else if message.body as! String == "quit" {
        DispatchQueue.main.async {
          NSApp.terminate(self)
        }
      }
    #endif
  }

}

