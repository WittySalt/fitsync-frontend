# ── Response headers policies (OWASP ZAP baseline findings) ──────────────────
# CloudFront adds these headers at the edge, because S3 cannot set them on the
# objects it serves. The same code runs in staging and prod; the only value that
# differs is the media bucket the app loads exercise images and avatars from
# (var.csp_media_origin). RUNBOOK.md, "Security headers", explains every header,
# every CSP source and the accepted risks (COEP first).

locals {
  # Each source is here because the app loads from it; see the RUNBOOK table.
  csp_directives = [
    "default-src 'self'",
    # Production build has no inline scripts or handlers (angular.json turns off
    # critical-CSS inlining) and no eval, so 'self' alone is enough.
    "script-src 'self'",
    # Angular injects component styles as <style> elements and the build inlines
    # the Google Fonts CSS; fonts.googleapis.com covers a build that could not inline it.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    # data: = CSS mask icons, blob:/data: = avatar cropper preview, www.google.com +
    # *.gstatic.com = brand logos (s2/favicons redirects to t0-t3.gstatic.com),
    # themealdb = recipe photos, img.youtube.com + vumbnail.com = video thumbnails.
    join(" ", compact([
      "img-src 'self' data: blob:",
      "https://www.google.com https://*.gstatic.com https://www.themealdb.com",
      "https://img.youtube.com https://vumbnail.com",
      var.csp_media_origin,
    ])),
    trimspace("media-src 'self' ${var.csp_media_origin}"),
    # API and the coach's streamed answer are same-origin /api; sign-in calls Cognito directly.
    "connect-src 'self' https://cognito-idp.${var.region}.amazonaws.com",
    "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ]
  content_security_policy = join("; ", local.csp_directives)

  # Features the app never uses are switched off. Left at the browser default on
  # purpose: fullscreen, autoplay, encrypted-media, picture-in-picture, web-share,
  # accelerometer and gyroscope, which the exercise video iframe delegates to
  # YouTube/Vimeo through its allow attribute. screen-wake-lock stays on for the
  # cook mode, which keeps the screen awake.
  permissions_policy = join(", ", [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "serial=()",
    "hid=()",
    "midi=()",
    "magnetometer=()",
    "display-capture=()",
    "xr-spatial-tracking=()",
    "browsing-topics=()",
    "screen-wake-lock=(self)",
  ])
}

# Default (SPA) behaviour: index.html, JS, CSS and static assets from S3.
resource "aws_cloudfront_response_headers_policy" "spa" {
  count   = var.enable_cloudfront ? 1 : 0
  name    = "${local.name}-spa-security-headers"
  comment = "Security headers for the FitSync SPA"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    content_type_options {
      override = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    content_security_policy {
      content_security_policy = local.content_security_policy
      override                = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = local.permissions_policy
      override = true
    }
    items {
      header   = "Cross-Origin-Opener-Policy"
      value    = "same-origin"
      override = true
    }
    items {
      header   = "Cross-Origin-Resource-Policy"
      value    = "same-origin"
      override = true
    }
    # No Cross-Origin-Embedder-Policy: require-corp would block the brand logos,
    # recipe photos, thumbnails and the video iframe. Accepted risk, see RUNBOOK.md.
  }

  # S3 answers with "Server: AmazonS3"; ZAP reports it as server information.
  remove_headers_config {
    items {
      header = "Server"
    }
  }
}

# /api/* behaviour: JSON and the coach's event stream from the gateway. These
# responses are never rendered as a page, so they get transport and sniffing
# protection plus a deny-everything CSP, not the SPA's CSP. Headers the gateway
# sets itself win (override = false), except HSTS and nosniff, which must hold
# for every response on the domain.
resource "aws_cloudfront_response_headers_policy" "api" {
  count   = var.enable_cloudfront && var.api_origin_domain != "" ? 1 : 0
  name    = "${local.name}-api-security-headers"
  comment = "Security headers for the FitSync /api proxy"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = false
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false
    }
    content_security_policy {
      content_security_policy = "default-src 'none'; frame-ancestors 'none'"
      override                = false
    }
  }

  custom_headers_config {
    items {
      header   = "Cross-Origin-Resource-Policy"
      value    = "same-origin"
      override = false
    }
  }
}
