"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var fs = require("fs");
var path = require("path");
var util = require("util");
var source_map_1 = require("source-map");
var sourceMapsWithOffsets = [{
        filePath: 'cshtml-ts-first-script.js.map',
        linesOffset: parseInt(process.env['cshtml-ts-first-script.js.map-offset'], 10)
    },
    {
        filePath: 'cshtml-ts-second-script.js.map',
        linesOffset: parseInt(process.env['cshtml-ts-second-script.js.map-offset'], 10)
    }];
var fsReadDir = util.promisify(fs.readdir);
var fsReadFile = util.promisify(fs.readFile);
var fsWriteFile = util.promisify(fs.writeFile);
var sourceMapsDir = 'composites/out/';
var combiendSourceMapsPath = 'composites/manually-combined/';
var SourceMapCombiner = /** @class */ (function () {
    function SourceMapCombiner(_sourceMaps) {
        this._sourceMaps = _sourceMaps;
    }
    SourceMapCombiner.prototype.combine = function () {
        return __awaiter(this, void 0, void 0, function () {
            var combinedSourceMapFileName, combinedSourcePath, combinedSourceContents;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        combinedSourceMapFileName = 'combined-cshtml.html';
                        combinedSourcePath = path.resolve(combiendSourceMapsPath, 'combined-cshtml.cshtml');
                        return [4 /*yield*/, fsReadFile(combinedSourcePath, 'utf8')];
                    case 1:
                        combinedSourceContents = _a.sent();
                        return [4 /*yield*/, Promise.all(this._sourceMaps.map(function (sourceMapWithOffset) { return __awaiter(_this, void 0, void 0, function () {
                                var generator, consumer, combinedSourceMap;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            generator = new source_map_1.SourceMapGenerator({ file: path.basename(combinedSourcePath) });
                                            generator.setSourceContent('combined-cshtml.cshtml', combinedSourceContents);
                                            consumer = new source_map_1.SourceMapConsumer(sourceMapWithOffset.sourceMap);
                                            consumer.eachMapping(function (mapping) {
                                                var newMapping = _this.consumedToGeneratedMapping(sourceMapWithOffset.linesOffset, mapping);
                                                console.log(JSON.stringify(newMapping));
                                                generator.addMapping(newMapping);
                                            });
                                            combinedSourceMap = generator.toString();
                                            return [4 /*yield*/, fsWriteFile(sourceMapWithOffset.outputFilePath, combinedSourceMap)];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    SourceMapCombiner.prototype.consumedToGeneratedMapping = function (linesOffset, mapping) {
        return {
            generated: { column: mapping.generatedColumn, line: linesOffset + mapping.generatedLine },
            original: { column: mapping.originalColumn, line: mapping.originalLine },
            name: mapping.name,
            source: 'combined-cshtml.cshtml'
        };
    };
    // public static async fromFolder(sourceMapsDir: string): Promise<SourceMapCombiner> {
    //     const filePaths = await fsReadDir(sourceMapsDir);
    //     const jsMapFilePaths = filePaths.filter(filePath => filePath.indexOf('.js.map') >= 0);
    //     const jsMapFullFilePaths = jsMapFilePaths.map(filePath => path.resolve(sourceMapsDir, filePath));
    //     return this.fromFiles(jsMapFullFilePaths);
    // }
    SourceMapCombiner.fromFiles = function (filePathsWithOffset) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceMapWithOffsets;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.all(filePathsWithOffset.map(function (filePathWithOffset) { return __awaiter(_this, void 0, void 0, function () {
                            var fileFullPath, json, outputFilePath;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        fileFullPath = path.resolve(sourceMapsDir, filePathWithOffset.filePath);
                                        return [4 /*yield*/, SourceMapCombiner.readJSONFile(fileFullPath)];
                                    case 1:
                                        json = _a.sent();
                                        outputFilePath = path.resolve(combiendSourceMapsPath, filePathWithOffset.filePath);
                                        return [2 /*return*/, { sourceMap: json, linesOffset: filePathWithOffset.linesOffset, outputFilePath: outputFilePath }];
                                }
                            });
                        }); }))];
                    case 1:
                        sourceMapWithOffsets = _a.sent();
                        return [2 /*return*/, new SourceMapCombiner(sourceMapWithOffsets)];
                }
            });
        });
    };
    // private static readManyJSONFile(filePaths: string[]): Promise<RawSourceMap[]> {
    //     return Promise.all(filePaths.map(async (path) => {
    //         return await SourceMapCombiner.readJSONFile(path);
    //     }));
    // }
    SourceMapCombiner.readJSONFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var contents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fsReadFile(filePath, 'utf8')];
                    case 1:
                        contents = _a.sent();
                        return [2 /*return*/, JSON.parse(contents)];
                }
            });
        });
    };
    return SourceMapCombiner;
}());
SourceMapCombiner.fromFiles(sourceMapsWithOffsets).then(function (combiner) { return combiner.combine(); });
//# sourceMappingURL=combine-maps.js.map