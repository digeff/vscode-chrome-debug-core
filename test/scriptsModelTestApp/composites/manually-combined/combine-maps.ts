import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { SourceMapConsumer, RawSourceMap, SourceMapGenerator, MappingItem, Mapping } from 'source-map';

const sourceMapsWithOffsets: FilePathWithOffset[] = [{
    filePath: 'cshtml-ts-first-script.js.map',
    linesOffset: parseInt(process.env['cshtml-ts-first-script.js.map-offset'], 10)
},
{
    filePath: 'cshtml-ts-second-script.js.map',
    linesOffset: parseInt(process.env['cshtml-ts-second-script.js.map-offset'], 10)
}];

const fsReadDir = util.promisify(fs.readdir);
const fsReadFile = util.promisify(fs.readFile);
const fsWriteFile = util.promisify(fs.writeFile);

const sourceMapsDir = 'composites/out/';
const combiendSourceMapsPath = 'composites/manually-combined/';

interface SourceMapWithOffset {
    linesOffset: number;
    sourceMap: RawSourceMap;
    outputFilePath: string;
}

interface FilePathWithOffset {
    linesOffset: number;
    filePath: string;
}

class SourceMapCombiner {
    constructor(private readonly _sourceMaps: SourceMapWithOffset[]) { }

    // public static async fromFolder(sourceMapsDir: string): Promise<SourceMapCombiner> {
    //     const filePaths = await fsReadDir(sourceMapsDir);
    //     const jsMapFilePaths = filePaths.filter(filePath => filePath.indexOf('.js.map') >= 0);
    //     const jsMapFullFilePaths = jsMapFilePaths.map(filePath => path.resolve(sourceMapsDir, filePath));
    //     return this.fromFiles(jsMapFullFilePaths);
    // }

    public static async fromFiles(filePathsWithOffset: FilePathWithOffset[]): Promise<SourceMapCombiner> {
        const sourceMapWithOffsets = await Promise.all(filePathsWithOffset.map(async filePathWithOffset => {
            const fileFullPath = path.resolve(sourceMapsDir, filePathWithOffset.filePath);
            const json = await SourceMapCombiner.readJSONFile(fileFullPath);
            const outputFilePath = path.resolve(combiendSourceMapsPath, filePathWithOffset.filePath);
            return { sourceMap: json, linesOffset: filePathWithOffset.linesOffset, outputFilePath: outputFilePath } as SourceMapWithOffset;
        }));

        return new SourceMapCombiner(sourceMapWithOffsets);
    }

    // private static readManyJSONFile(filePaths: string[]): Promise<RawSourceMap[]> {
    //     return Promise.all(filePaths.map(async (path) => {
    //         return await SourceMapCombiner.readJSONFile(path);
    //     }));
    // }

    private static async readJSONFile(filePath: string): Promise<RawSourceMap> {
        const contents = await fsReadFile(filePath, 'utf8');
        return JSON.parse(contents);
    }

    public async combine(): Promise<void> {
        const combinedSourceMapFileName = 'combined-cshtml.html';
        const combinedSourcePath = path.resolve(combiendSourceMapsPath, 'combined-cshtml.cshtml');
        const combinedSourceContents = await fsReadFile(combinedSourcePath, 'utf8');
        await Promise.all(this._sourceMaps.map(async sourceMapWithOffset => {
            const generator = new SourceMapGenerator({ file: path.basename(combinedSourcePath) });
            generator.setSourceContent('combined-cshtml.cshtml', combinedSourceContents);
            const consumer = new SourceMapConsumer(sourceMapWithOffset.sourceMap);
            consumer.eachMapping(mapping => {
                const newMapping = this.consumedToGeneratedMapping(sourceMapWithOffset.linesOffset, mapping);
                console.log(JSON.stringify(newMapping));
                generator.addMapping(newMapping);
            });

            const combinedSourceMap = generator.toString();
            await fsWriteFile(sourceMapWithOffset.outputFilePath, combinedSourceMap);
        }));
    }

    private consumedToGeneratedMapping(linesOffset: number, mapping: MappingItem): Mapping {
        return {
            generated: { column: mapping.generatedColumn, line: linesOffset + mapping.generatedLine },
            original: { column: mapping.originalColumn, line: mapping.originalLine },
            name: mapping.name,
            source: 'combined-cshtml.cshtml'
        };
    }
}

SourceMapCombiner.fromFiles(sourceMapsWithOffsets).then(combiner => combiner.combine());
