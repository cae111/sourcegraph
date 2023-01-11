load("@bazel_skylib//rules:build_test.bzl", "build_test")
load("@aspect_rules_jest//jest:defs.bzl", _jest_test = "jest_test")
load("@aspect_rules_js//npm:defs.bzl", _npm_package = "npm_package")
load("@aspect_rules_ts//ts:defs.bzl", _ts_project = "ts_project")
load("@npm//:sass/package_json.bzl", sass_bin = "bin")
load("@npm//:postcss-cli/package_json.bzl", postcss_bin = "bin")
load("@bazel_skylib//rules:expand_template.bzl", "expand_template")

def ts_project(name, deps = [], **kwargs):
    deps = deps + [
        "//:node_modules/tslib",
    ]

    testonly = kwargs.pop("testonly", False)

    # Add standard test libraries for the repo test frameworks
    if testonly:
        deps = deps + [d for d in [
            "//:node_modules/@types/jest",
            "//:node_modules/@types/mocha",
            "//:node_modules/@types/testing-library__jest-dom",
        ] if not d in deps]

    # Default arguments for ts_project.
    _ts_project(
        name = name,
        deps = deps,

        # tsconfig options, default to the root
        tsconfig = kwargs.pop("tsconfig", "//:tsconfig"),
        composite = kwargs.pop("composite", True),
        declaration = kwargs.pop("declaration", True),
        declaration_map = kwargs.pop("declaration_map", True),
        resolve_json_module = kwargs.pop("resolve_json_module", True),
        source_map = kwargs.pop("source_map", True),

        # Rule options
        visibility = kwargs.pop("visibility", ["//visibility:public"]),
        testonly = testonly,
        supports_workers = False,

        # Allow any other args
        **kwargs
    )

    # TODO(bazel): remove when bazel build enforced on CI
    build_test(
        name = "%s_build_test" % name,
        targets = [name],
    )

def npm_package(name, srcs = [], **kwargs):
    replace_prefixes = kwargs.pop("replace_prefixes", {})

    # Modifications to package.json
    # TODO(bazel): remove when package.json can be updated in source
    srcs_no_pkg = [s for s in srcs if s != "package.json"]
    if len(srcs) > len(srcs_no_pkg):
        expand_template(
            name = "_updated-package-json",
            template = "package.json",
            out = "_updated-package.json",
            substitutions = {
                # TODO(bazel): remove use of .ts in package.json files
                "src/index.ts": "src/index.js",
            },
        )
        replace_prefixes["_updated-package.json"] = "package.json"
        srcs = srcs_no_pkg + ["_updated-package.json"]

    _npm_package(
        name = name,
        srcs = srcs,
        replace_prefixes = replace_prefixes,

        # Default visiblity
        visibility = kwargs.pop("visibility", ["//visibility:public"]),

        # Allow any other args
        **kwargs
    )

def _sass_out(n):
    return n.replace(".scss", "_sassy.css")

def sass(name, srcs, deps = [], **kwargs):
    visibility = kwargs.pop("visibility", ["//visibility:public"])

    sass_bin.sass(
        name = "_%s_sass" % name,
        srcs = srcs + deps,
        outs = [_sass_out(src) for src in srcs] + ["%s.map" % _sass_out(src) for src in srcs],
        args = [
            "--load-path=client",
            "--load-path=node_modules",
        ] + [
            "$(execpath {}):{}/{}".format(src, native.package_name(), _sass_out(src))
            for src in srcs
        ],
        visibility = ["//visibility:private"],
    )

    for src in srcs:
        _postcss(
            name = src.replace(".scss", "_css"),
            src = _sass_out(src),
            out = src.replace(".scss", ".css"),

            # Same visibility as filegroup of outputs
            visibility = visibility,
        )

    native.filegroup(
        name = name,
        srcs = [src.replace(".scss", ".css") for src in srcs],
        visibility = visibility,

        # Allow any other args
        **kwargs
    )

    # TODO(bazel): remove when bazel build enforced on CI
    build_test(
        name = "%s_build_test" % name,
        targets = [name],
    )

def _postcss(name, src, out, **kwargs):
    postcss_bin.postcss(
        name = name,
        srcs = [
            src,
            "%s.map" % src,
            "//:postcss_config_js",
        ],
        outs = [out],
        # NOTE: go up 3 segments out of bazel-out/platform/bin
        args = [
            "../../../$(execpath %s)" % src,
            "--config",
            "../../../$(execpath //:postcss_config_js)",
            "--output",
            "../../../$@",
        ],
        **kwargs
    )

def jest_test(name, data = [], **kwargs):
    # TODO(bazel): the config param must be a single file. Must manually
    # declare config dependencies and pass as 'data'.
    config = "//:jest.config.base"
    data = data + ["//:jest_config"] + native.glob(["**/__snapshots__/**/*.snap"])

    _jest_test(
        name = name,
        config = config,
        data = data,
        snapshots = True,
        **kwargs
    )
