import * as geom from "../format/geom";
import * as dbft from "../format/dragonBonesFormat";
import * as l2ft from "../format/live2DFormat";

const rotateMatrixA = geom.helpMatrixA;
const rotateMatrixB = geom.helpMatrixB;
let modelConfig: l2ft.ModelConfig;
let result: dbft.DragonBones;
let armature: dbft.Armature;
let defaultSkin: dbft.Skin;
/**
 * Convert Live2D format to DragonBones format.
 */
export default function (data: l2ft.ModelConfig): dbft.DragonBones | null {
    modelConfig = data;
    const l2Displays = modelConfig.modelImpl.displays;
    // Create dragonBones.
    result = new dbft.DragonBones();
    result.frameRate = 30; //
    result.name = modelConfig.name;
    result.version = dbft.DATA_VERSION_5_5;
    result.compatibleVersion = dbft.DATA_VERSION_5_5;
    // Create textureAtlas.
    let textureIndex = 0;
    for (const l2Texture of modelConfig.textures) {
        if (typeof l2Texture === "string") {
            continue;
        }

        const textureAtlas = new dbft.TextureAtlas();
        textureAtlas.name = result.name;
        textureAtlas.width = l2Texture.width;
        textureAtlas.height = l2Texture.height;
        textureAtlas.imagePath = l2Texture.file;

        const subTexture = new dbft.Texture();
        subTexture.name = result.name + "_" + textureIndex.toString().padStart(2, "0");
        subTexture.x = 0;
        subTexture.y = 0;
        subTexture.width = textureAtlas.width;
        subTexture.height = textureAtlas.height;
        textureAtlas.SubTexture.push(subTexture);
        textureIndex++;

        result.textureAtlas.push(textureAtlas);
    }

    // Create armatures.
    armature = new dbft.Armature();
    armature.name = data.name;
    result.armature.push(armature);
    // Create bones.
    const rootBone = new dbft.Bone();
    rootBone.name = "DST_BASE";
    rootBone.length = 150.0;
    armature.bone.push(rootBone);
    // Modify bone rotate.
    rotateMatrixA.identity();
    rotateMatrixA.rotate(Math.PI * 0.5);
    rotateMatrixB.identity();
    rotateMatrixB.rotate(-Math.PI * 0.5);

    for (const l2Part of modelConfig.modelImpl.parts) {
        for (const l2Bone of l2Part.bones) {
            const l2Parent = modelConfig.modelImpl.getBone(l2Bone.parent);
            const isSurfaceParent = l2Parent !== null && l2Parent instanceof l2ft.Surface;
            const l2Timelines = l2Bone.animation.timelines;

            if (l2Bone instanceof l2ft.Bone) {
                const poseTransform = getPose(l2Timelines, l2Bone.transformFrames, (a, b, t) => {
                    const result = new l2ft.Transform();
                    if (b) {
                        result.interpolation(a, b, t);
                    }
                    else {
                        result.copyFrom(a);
                    }

                    return result;
                });

                const bone = new dbft.Bone();
                bone.length = 150.0;
                bone.name = l2Bone.name;
                bone.parent = l2Parent ? (l2Parent.name === rootBone.name ? "" : l2Parent.name) : "";

                if (isSurfaceParent) { // Scale and rotate.
                    bone.transform.x = (poseTransform.x - 0.5) * 400.0;
                    bone.transform.y = (poseTransform.y - 0.5) * 400.0;

                    if (poseTransform.reflectX || poseTransform.reflectY) {
                        bone.transform.skY = poseTransform.rotate + 90.0;
                        bone.transform.skX = poseTransform.rotate + 90.0;
                    }
                    else {
                        bone.transform.skY = poseTransform.rotate - 90.0;
                        bone.transform.skX = poseTransform.rotate - 90.0;
                    }

                    bone.transform.scX = poseTransform.scaleX * (poseTransform.reflectX ? -1.0 : 1.0);
                    bone.transform.scY = poseTransform.scaleY * (poseTransform.reflectY ? -1.0 : 1.0);
                }
                else if (bone.parent) { // Rotate.
                    rotateMatrixA.transformPoint(poseTransform.x, poseTransform.y, bone.transform);

                    const parentTransform = (l2Parent as l2ft.Bone).transformFrames[0];

                    if (poseTransform.reflectX || poseTransform.reflectY) {
                        bone.transform.skY = poseTransform.rotate + 180.0;
                        bone.transform.skX = poseTransform.rotate + 180.0;
                    }
                    else {
                        bone.transform.skY = poseTransform.rotate;
                        bone.transform.skX = poseTransform.rotate;
                    }

                    if (parentTransform.reflectX || parentTransform.reflectY) {
                        bone.transform.skY = poseTransform.rotate;
                        bone.transform.skX = poseTransform.rotate;
                        bone.transform.scX = poseTransform.scaleX * (poseTransform.reflectX ? 1.0 : -1.0);
                        bone.transform.scY = poseTransform.scaleY * (poseTransform.reflectY ? -1.0 : 1.0);
                    }
                    else {
                        bone.transform.scX = poseTransform.scaleX * (poseTransform.reflectX ? -1.0 : 1.0);
                        bone.transform.scY = poseTransform.scaleY * (poseTransform.reflectY ? -1.0 : 1.0);
                    }
                }
                else { // Rotate and offset.
                    bone.transform.x = poseTransform.x - modelConfig.modelImpl.stageWidth * 0.5;
                    bone.transform.y = poseTransform.y - modelConfig.modelImpl.stageHeight;

                    if (poseTransform.reflectX || poseTransform.reflectY) {
                        bone.transform.skY = poseTransform.rotate + 90.0;
                        bone.transform.skX = poseTransform.rotate + 90.0;
                    }
                    else {
                        bone.transform.skY = poseTransform.rotate - 90.0;
                        bone.transform.skX = poseTransform.rotate - 90.0;
                    }

                    bone.transform.scX = poseTransform.scaleX * (poseTransform.reflectX ? -1.0 : 1.0);
                    bone.transform.scY = poseTransform.scaleY * (poseTransform.reflectY ? -1.0 : 1.0);
                }

                if (!bone.transform.scX) {
                    bone.transform.scX = 0.0000001;
                }

                if (!bone.transform.scY) {
                    bone.transform.scY = 0.0000001;
                }

                armature.bone.push(bone);
            }
            else if (l2Bone instanceof l2ft.Surface) {
                const poseVertices = getPose(l2Timelines, l2Bone.deformFrames, (a, b, t) => {
                    const result = new Array<number>();
                    if (b) {
                        vertivesInterpolation(result, a, b, t);
                    }
                    else {
                        vertivesCopyFrom(result, a);
                    }

                    return result;
                });
                const surface = new dbft.Surface();
                surface.segmentX = l2Bone.segmentX;
                surface.segmentY = l2Bone.segmentY;
                surface.name = l2Bone.name;
                surface.parent = l2Parent ? (l2Parent.name === rootBone.name ? "" : l2Parent.name) : "";
                surface.vertices.length = poseVertices.length;

                for (let i = 0, l = poseVertices.length; i < l; i += 2) {
                    if (isSurfaceParent) { // Scale.
                        surface.vertices[i] = (poseVertices[i] - 0.5) * 400.0;
                        surface.vertices[i + 1] = (poseVertices[i + 1] - 0.5) * 400.0;
                    }
                    else if (surface.parent) { // Rotate.
                        rotateMatrixA.transformPoint(poseVertices[i], poseVertices[i + 1], geom.helpPointA);
                        surface.vertices[i] = geom.helpPointA.x;
                        surface.vertices[i + 1] = geom.helpPointA.y;

                    }
                    else { // Offset.
                        surface.vertices[i] = poseVertices[i] - modelConfig.modelImpl.stageWidth * 0.5;
                        surface.vertices[i + 1] = poseVertices[i + 1] - modelConfig.modelImpl.stageHeight;
                    }
                }

                armature.bone.push(surface);
            }
        }
    }
    // Sort bones.
    armature.sortBones();
    // armature.localToGlobal();
    // Create slots and skins.
    defaultSkin = new dbft.Skin();

    for (const l2Display of l2Displays) {
        const l2Parent = modelConfig.modelImpl.getBone(l2Display.parent);
        const isSurfaceParent = l2Parent !== null && l2Parent instanceof l2ft.Surface;
        const l2Timelines = l2Display.animation.timelines;

        if (l2Display instanceof l2ft.Mesh) {
            // const zOrder = getPose(l2Timelines, l2Display.zOrderFrames, (a, b, t) => {
            //     return a;
            // });

            const alpha = getPose(l2Timelines, l2Display.alphaFrames, (a, b, t) => {
                return b === null ? a : a + (b - a) * t;
            });

            const poseVertices = getPose(l2Timelines, l2Display.deformFrames, (a, b, t) => {
                const result = new Array<number>();
                if (b) {
                    vertivesInterpolation(result, a, b, t);
                }
                else {
                    vertivesCopyFrom(result, a);
                }

                return result;
            });
            // Create slots.
            const slot = new dbft.Slot();
            slot.name = l2Display.name;
            slot.parent = l2Parent ? l2Parent.name : "";
            // slot.color.aM = Math.min(Math.round(alpha * 100), 100); TODO
            armature.slot.push(slot);
            // Create displays.
            const display = new dbft.MeshDisplay();
            display.name = l2Display.name;
            display.path = result.name + "_" + (l2Display.textureIndex >= 0 ? l2Display.textureIndex : 0).toString().padStart(2, "0");
            // UVs.
            for (const value of l2Display.uvs) {
                display.uvs.push(value);
            }
            // Triangles.
            for (const index of l2Display.indices) {
                display.triangles.push(index);
            }
            // Vertices.
            display.vertices.length = poseVertices.length;

            for (let i = 0, l = poseVertices.length; i < l; i += 2) {
                if (isSurfaceParent) { // Scale.
                    display.vertices[i] = (poseVertices[i] - 0.5) * 400.0;
                    display.vertices[i + 1] = (poseVertices[i + 1] - 0.5) * 400.0;
                }
                else if (slot.parent !== rootBone.name) { // Rotate.
                    rotateMatrixA.transformPoint(poseVertices[i], poseVertices[i + 1], geom.helpPointA);
                    display.vertices[i] = geom.helpPointA.x;
                    display.vertices[i + 1] = geom.helpPointA.y;
                }
                else { // Offset.
                    display.vertices[i] = poseVertices[i] - modelConfig.modelImpl.stageWidth * 0.5;
                    display.vertices[i + 1] = poseVertices[i + 1] - modelConfig.modelImpl.stageHeight;
                }
            }

            // const edges = dbft.getEdgeFormTriangles(display.triangles);
            // for (const value of edges) {
            //     display.edges.push(value);
            // }

            // SkinSlot.
            const skinSlot = new dbft.SkinSlot();
            skinSlot.name = l2Display.name;
            skinSlot.display.push(display);
            defaultSkin.slot.push(skinSlot);
        }
    }

    armature.skin.push(defaultSkin);
    // Create animations.
    if (modelConfig.modelImpl.animations.timelines.length > 0) {
        for (const l2Part of modelConfig.modelImpl.parts) {
            // Create bone timelines.
            for (const l2Bone of l2Part.bones) {
                const l2Timelines = l2Bone.animation.timelines;
                const bone = armature.getBone(l2Bone.name);
                if (l2Timelines.length === 0 || !bone) {
                    continue;
                }

                const l2Parent = modelConfig.modelImpl.getBone(l2Bone.parent);
                const isSurfaceParent = l2Parent !== null && l2Parent instanceof l2ft.Surface;

                if (l2Bone instanceof l2ft.Bone) {
                    createAnimation(l2Timelines, l2Bone.transformFrames, bone, (l2Timeline, l2Frames, target, offset, blendAnimation) => {
                        const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(l2Timeline.name) as l2ft.TimelineInfo;
                        const totalValue = l2TimelineInfo.maximum - l2TimelineInfo.minimum;
                        const timeline = new dbft.BoneTimeline();
                        timeline.name = target.name;

                        for (let i = 0; i < l2Timeline.frameCount; ++i) {
                            const progress = (l2Timeline.frames[i] - l2TimelineInfo.minimum) / totalValue;
                            const l2Frame = l2Frames[offset + i];
                            const translateFrame = new dbft.BoneTranslateFrame();
                            const rotateFrame = new dbft.BoneRotateFrame();
                            const scaleFrame = new dbft.BoneScaleFrame();
                            let x = 0.0;
                            let y = 0.0;

                            translateFrame._position = rotateFrame._position = scaleFrame._position = Math.floor(progress * blendAnimation.duration);
                            translateFrame.tweenEasing = rotateFrame.tweenEasing = scaleFrame.tweenEasing = i === l2Timeline.frameCount - 1 ? NaN : 0.0;

                            if (isSurfaceParent) {
                                x = (l2Frame.x - 0.5) * 400.0;
                                y = (l2Frame.y - 0.5) * 400.0;
                            }
                            else {
                                x = l2Frame.x;
                                y = l2Frame.y;
                            }

                            if (!target.parent || isSurfaceParent) {
                                if (target.parent) {
                                    translateFrame.x = x - target.transform.x;
                                    translateFrame.y = y - target.transform.y;

                                    if (l2Frame.reflectX || l2Frame.reflectY) {
                                        rotateFrame.rotate = l2Frame.rotate + 90.0 - target.transform.skY;
                                    }
                                    else {
                                        rotateFrame.rotate = l2Frame.rotate - 90.0 - target.transform.skY;
                                    }
                                }
                                else {
                                    translateFrame.x = x - target.transform.x - modelConfig.modelImpl.stageWidth * 0.5;
                                    translateFrame.y = y - target.transform.y - modelConfig.modelImpl.stageHeight;

                                    if (l2Frame.reflectX || l2Frame.reflectY) {
                                        rotateFrame.rotate = l2Frame.rotate + 90.0 - target.transform.skY;
                                    }
                                    else {
                                        rotateFrame.rotate = l2Frame.rotate - 90.0 - target.transform.skY;
                                    }
                                }

                                scaleFrame.x = l2Frame.scaleX * (l2Frame.reflectX ? -1.0 : 1.0) / target.transform.scX;
                                scaleFrame.y = l2Frame.scaleY * (l2Frame.reflectY ? -1.0 : 1.0) / target.transform.scY;
                            }
                            else {
                                rotateMatrixA.transformPoint(x, y, translateFrame);
                                translateFrame.x -= target.transform.x;
                                translateFrame.y -= target.transform.y;

                                const parentTransform = (l2Parent as l2ft.Bone).transformFrames[0];

                                if (l2Frame.reflectX || l2Frame.reflectY) {
                                    rotateFrame.rotate = l2Frame.rotate + 180 - target.transform.skY;
                                }
                                else {
                                    rotateFrame.rotate = l2Frame.rotate - target.transform.skY;
                                }

                                if (parentTransform.reflectX || parentTransform.reflectY) {
                                    rotateFrame.rotate = l2Frame.rotate - target.transform.skY;
                                    scaleFrame.x = l2Frame.scaleX * (l2Frame.reflectX ? 1.0 : -1.0) / target.transform.scX;
                                    scaleFrame.y = l2Frame.scaleY * (l2Frame.reflectY ? -1.0 : 1.0) / target.transform.scY;
                                }
                                else {
                                    scaleFrame.x = l2Frame.scaleX * (l2Frame.reflectX ? -1.0 : 1.0) / target.transform.scX;
                                    scaleFrame.y = l2Frame.scaleY * (l2Frame.reflectY ? -1.0 : 1.0) / target.transform.scY;
                                }
                            }

                            timeline.translateFrame.push(translateFrame);
                            timeline.rotateFrame.push(rotateFrame);
                            timeline.scaleFrame.push(scaleFrame);
                        }

                        modifyFrames(timeline.translateFrame);
                        modifyFrames(timeline.rotateFrame);
                        modifyFrames(timeline.scaleFrame);
                        blendAnimation.bone.push(timeline);
                    });
                }
                else if (l2Bone instanceof l2ft.Surface) {
                    createAnimation(l2Timelines, l2Bone.deformFrames, bone as dbft.Surface, (l2Timeline, l2Frames, target, offset, parentAnimation) => {
                        const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(l2Timeline.name) as l2ft.TimelineInfo;
                        const totalValue = l2TimelineInfo.maximum - l2TimelineInfo.minimum;
                        const timeline = new dbft.DeformTimeline();
                        timeline.name = target.name;

                        for (let i = 0; i < l2Timeline.frameCount; ++i) {
                            const progress = (l2Timeline.frames[i] - l2TimelineInfo.minimum) / totalValue;
                            const l2Frame = l2Frames[offset + i];
                            const frame = new dbft.DeformFrame();
                            frame._position = Math.floor(progress * parentAnimation.duration);
                            frame.tweenEasing = i === l2Timeline.frameCount - 1 ? NaN : 0.0;
                            createDeformFrame(
                                frame,
                                l2Frame,
                                target.vertices,
                                isSurfaceParent,
                                target.parent.length > 0
                            );
                            timeline.frame.push(frame);
                        }

                        modifyFrames(timeline.frame);
                        parentAnimation.surface.push(timeline);
                    });
                }
            }
            // Create slot timeines.
            for (const l2Display of l2Part.displays) {
                const l2Timelines = l2Display.animation.timelines;
                const slot = armature.getSlot(l2Display.name);
                if (l2Timelines.length === 0 || !slot) {
                    continue;
                }

                const l2Parent = modelConfig.modelImpl.getBone(l2Display.parent);
                const isSurfaceParent = l2Parent !== null && l2Parent instanceof l2ft.Surface;

                if (l2Display instanceof l2ft.Mesh) {
                    const meshDisplay = armature.getMesh(defaultSkin.name, l2Display.name, l2Display.name);
                    if (!meshDisplay) {
                        continue;
                    }
                    //
                    // createAnimation(l2Timelines, l2Display.alphaFrames, meshDisplay, (l2Timeline, l2Frames, target, offset, parentAnimation) => {
                    //     const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(l2Timeline.name) as l2ft.TimelineInfo;
                    //     const totalValue = l2TimelineInfo.maximum - l2TimelineInfo.minimum;
                    //     const timeline = new dbft.SlotTimeline();
                    //     timeline.name = target.name;

                    //     for (let i = 0; i < l2Timeline.frameCount; ++i) {
                    //         const progress = (l2Timeline.frames[i] - l2TimelineInfo.minimum) / totalValue;
                    //         const l2Frame = l2Frames[offset + i];
                    //         const frame = new dbft.SlotColorFrame();
                    //         frame._position = Math.floor(progress * parentAnimation.duration);
                    //         frame.tweenEasing = i === l2Timeline.frameCount - 1 ? NaN : 0.0;
                    //         frame.color.aM = Math.min(Math.round(l2Frame * 100), 100);
                    //         timeline.colorFrame.push(frame);
                    //     }

                    //     modifyFrames(timeline.frame);
                    //     parentAnimation.slot.push(timeline);
                    // });
                    //
                    createAnimation(l2Timelines, l2Display.deformFrames, meshDisplay, (l2Timeline, l2Frames, target, offset, parentAnimation) => {
                        const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(l2Timeline.name) as l2ft.TimelineInfo;
                        const totalValue = l2TimelineInfo.maximum - l2TimelineInfo.minimum;
                        const timeline = new dbft.SlotDeformTimeline();
                        timeline.name = target.name;
                        timeline.slot = target.name;

                        for (let i = 0; i < l2Timeline.frameCount; ++i) {
                            const progress = (l2Timeline.frames[i] - l2TimelineInfo.minimum) / totalValue;
                            const l2Frame = l2Frames[offset + i];
                            const frame = new dbft.DeformFrame();
                            frame._position = Math.floor(progress * parentAnimation.duration);
                            frame.tweenEasing = i === l2Timeline.frameCount - 1 ? NaN : 0.0;
                            createDeformFrame(
                                frame,
                                l2Frame,
                                target.vertices,
                                isSurfaceParent,
                                slot.parent !== rootBone.name
                            );
                            timeline.frame.push(frame);
                        }

                        modifyFrames(timeline.frame);
                        parentAnimation.ffd.push(timeline);
                    });
                }
            }
        }
    }

    if (modelConfig.motions) { // Create motion animations.
        for (const motionName in modelConfig.motions) {
            let index = 0;
            const motionConfigs = modelConfig.motions[motionName];

            for (const motionConfig of motionConfigs) {
                if (!motionConfig.motion) {
                    continue;
                }

                const animationName = motionConfigs.length > 1 ? (motionName + "_" + index.toString().padStart(2, "0")) : motionName;
                const animation = new dbft.Animation();
                animation.playTimes = 0;
                animation.fadeInTime = motionConfig.fade_in ? motionConfig.fade_in * 0.001 : (motionConfig.motion.fade_in ? motionConfig.motion.fade_in * 0.001 : 0.3);
                animation.name = animationName;
                animation.type = dbft.AnimationType.Tree;

                for (const timelineName in motionConfig.motion.values) {
                    const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(timelineName);
                    if (!l2TimelineInfo) {
                        continue;
                    }

                    let duration = 0;
                    const values = motionConfig.motion.values[timelineName];
                    const timeline = new dbft.AnimationTimeline();
                    let prevFrame: dbft.FloatFrame | null = null;
                    timeline.name = timelineName;

                    for (let i = 0, l = values.length; i < l; ++i) {
                        const value = values[i];
                        const frame = new dbft.FloatFrame();

                        if (i !== l - 1) {
                            frame.tweenEasing = 0;
                            duration += frame.duration;
                        }

                        frame.value = (value - l2TimelineInfo.minimum) / (l2TimelineInfo.maximum - l2TimelineInfo.minimum);
                        timeline.progressFrame.push(frame);

                        if (prevFrame && prevFrame.value - frame.value > 0.30) { //
                            prevFrame.tweenEasing = NaN;
                        }

                        prevFrame = frame;
                    }

                    animation.duration = Math.max(duration, animation.duration);
                    animation.animation.push(timeline);
                }

                for (const timelineName in motionConfig.motion.alphas) {
                    const part = modelConfig.modelImpl.getPart(timelineName);
                    if (!part) {
                        continue;
                    }

                    let duration = 0;
                    const alphas = motionConfig.motion.alphas[timelineName];

                    for (const l2Display of part.displays) {
                        if (l2Display instanceof l2ft.Mesh) {
                            const timeline = new dbft.SlotTimeline();
                            timeline.name = l2Display.name;

                            for (let i = 0, l = alphas.length; i < l; ++i) {
                                const alpha = alphas[i];
                                const frame = new dbft.SlotColorFrame();

                                if (i !== l - 1) {
                                    frame.tweenEasing = 0;
                                    duration += frame.duration;
                                }

                                frame.value.aM = Math.min(Math.round(alpha * 100), 100);
                                timeline.colorFrame.push(frame);
                            }

                            animation.slot.push(timeline);
                        }
                    }

                    animation.duration = Math.max(duration, animation.duration);
                }

                armature.animation.unshift(animation);
                index++;
            }
        }
    }

    if (modelConfig.expressions) {
        for (const expressionConfig of modelConfig.expressions) {
            const expression = expressionConfig.expression;
            if (!expression || !expression.params || expression.params.length === 0) {
                continue;
            }

            const animation = new dbft.Animation();
            animation.playTimes = 1;
            animation.fadeInTime = expression.fade_in ? expression.fade_in * 0.001 : 0.3;
            animation.name = expressionConfig.name;
            animation.type = dbft.AnimationType.Tree;

            for (const timelineConfig of expression.params) {
                const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(timelineConfig.id);
                if (!l2TimelineInfo) {
                    continue;
                }

                const timeline = new dbft.AnimationTimeline();
                timeline.name = l2TimelineInfo.name;

                const frame = new dbft.FloatFrame();
                frame.value = (timelineConfig.val - l2TimelineInfo.minimum) / (l2TimelineInfo.maximum - l2TimelineInfo.minimum);
                timeline.progressFrame.push(frame);

                if (timelineConfig.def) {
                    // TODO
                }

                animation.duration = 0;
                animation.animation.push(timeline);
            }

            armature.animation.unshift(animation);
        }
    }

    return result;
}

function getPose<T>(
    l2Timelines: l2ft.Timeline[], frames: T[],
    action: (a: T, b: T | null, t: number) => T,
    level: number = -1, offset: number = -1
): T {
    if (level < 0) {
        if (l2Timelines.length > 0) {
            level = l2Timelines.length - 1;
            offset = 0;
        }
        else {
            return frames[0];
        }
    }

    const l2Timeline = l2Timelines[level];
    const l2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(l2Timeline.name) as l2ft.TimelineInfo;
    let index = l2Timeline.frames.indexOf(l2TimelineInfo.default);
    let count = 1;

    if (index < 0) {
        if (l2TimelineInfo.default <= l2Timeline.frames[0]) {
            index = 0;
        }
        else if (l2TimelineInfo.default >= l2Timeline.frames[l2Timeline.frames.length - 1]) {
            index = l2Timeline.frames.length - 1;
        }
    }

    for (let i = 0; i < level; ++i) {
        count *= l2Timelines[i].frameCount;
    }

    if (index < 0) {
        for (const value of l2Timeline.frames) {
            index++;
            if (value > l2TimelineInfo.default) {
                const prevValue = l2Timeline.frames[index - 1];
                const progress = (l2TimelineInfo.default - prevValue) / (value - prevValue);

                if (level === 0) {
                    return action(
                        frames[offset + index - 1], frames[offset + index],
                        progress
                    );
                }

                index = offset + index * count;

                return action(
                    getPose(l2Timelines, frames, action, level - 1, index - 1), getPose(l2Timelines, frames, action, level - 1, index),
                    progress
                );
            }
        }

        throw new Error();
    }
    else {
        if (level === 0) {
            return frames[offset + index];
        }

        index = offset + count;

        return getPose(l2Timelines, frames, action, level - 1, index);
    }
}

function createAnimation<F, T extends { name: string }>(
    l2Timelines: l2ft.Timeline[], frames: F[], target: T,
    action: (l2Timeline: l2ft.Timeline, frames: F[], target: T, offset: number, blendAnimation: dbft.Animation) => void,
    indices: number[] = [0], parentAnimation: dbft.Animation | null = null
): void {
    const level = l2Timelines.length - indices.length;
    const index = indices[indices.length - 1];
    const l2Timeline = l2Timelines[level];
    let animation = armature.getAnimation(l2Timeline.name) as dbft.Animation | null;

    if (!animation) {
        animation = new dbft.Animation();
        animation.playTimes = 0;
        animation.duration = modelConfig.modelImpl.frameCount;
        animation.name = l2Timeline.name;
        animation.type = dbft.AnimationType.Node;
        armature.animation.unshift(animation);
    }

    if (l2Timelines.length === 1) {
        action(l2Timeline, frames, target, 0, animation);
        return;
    }

    const blendAnimation = new dbft.Animation();
    blendAnimation.playTimes = 0;
    blendAnimation.duration = animation.duration;
    blendAnimation.type = dbft.AnimationType.Node;
    blendAnimation.blendType = dbft.AnimationBlendType.E1D;
    armature.animation.push(blendAnimation);
    //
    const blendTimeline = new dbft.AnimationTimeline();
    const frameBegin = new dbft.FloatFrame();
    const frameEnd = new dbft.FloatFrame();
    frameBegin._position = 0;
    frameBegin.value = 0.0;
    frameBegin.tweenEasing = 0.0;
    frameEnd._position = animation.duration;
    frameEnd.value = 1.0;
    blendTimeline.progressFrame.push(frameBegin, frameEnd);
    modifyFrames(blendTimeline.progressFrame);

    if (parentAnimation) {
        let blendName = target.name;

        let i = 0;
        for (const value of indices) {
            if (i > 0) {
                blendName += "_" + (value).toString().padStart(2, "0");
            }

            i++;
        }

        blendTimeline.name = blendAnimation.name = blendName;
        //
        const parentL2Timleine = l2Timelines[level + 1];
        const parentL2TimelineInfo = modelConfig.modelImpl.getTimelineInfo(parentL2Timleine.name) as l2ft.TimelineInfo;
        const totalValue = parentL2TimelineInfo.maximum - parentL2TimelineInfo.minimum;
        const childTimeline = new dbft.AnimationTimeline();
        const frameBegin = new dbft.BoneTranslateFrame();
        const frameEnd = new dbft.BoneTranslateFrame();
        childTimeline.x = (parentL2Timleine.frames[index] - parentL2TimelineInfo.minimum) / totalValue * 2.0 - 1.0;
        childTimeline.name = blendAnimation.name;
        frameBegin._position = 0;
        frameBegin.x = -1.0;
        frameBegin.tweenEasing = 0.0;
        frameEnd._position = parentAnimation.duration;
        frameEnd.x = 1.0;
        childTimeline.parameterFrame.push(frameBegin, frameEnd);
        modifyFrames(childTimeline.parameterFrame);
        parentAnimation.animation.push(childTimeline);
    }
    else {
        blendTimeline.name = blendAnimation.name = target.name + "_A";
    }

    animation.animation.push(blendTimeline);

    if (level === 0) {
        let offset = 0;

        for (let i = 0, l = indices.length; i < l; ++i) {
            const value = indices[i];
            let count = 1;

            for (let j = 0; j < l2Timelines.length - i; ++j) {
                count *= l2Timelines[j].frameCount;
            }

            offset += value * count; // TODO check
        }

        action(l2Timeline, frames, target, offset, blendAnimation);
    }
    else {
        for (let i = 0, l = l2Timeline.frameCount; i < l; ++i) {
            const childIndices = indices.concat();
            childIndices.push(i);

            createAnimation(l2Timelines, frames, target, action, childIndices, blendAnimation);
        }
    }
}

function createDeformFrame(
    deformFrame: dbft.DeformFrame,
    l2DeformFrame: number[],
    pose: number[],
    isSurfaceParent: boolean,
    isRotatedParent: boolean
): void {
    for (let j = 0, lJ = l2DeformFrame.length; j < lJ; j += 2) {
        if (isSurfaceParent) { // Scale.
            deformFrame.vertices[j] = (l2DeformFrame[j] - 0.5) * 400.0 - pose[j];
            deformFrame.vertices[j + 1] = (l2DeformFrame[j + 1] - 0.5) * 400.0 - pose[j + 1];
        }
        else if (isRotatedParent) { // Rotate.
            rotateMatrixA.transformPoint(l2DeformFrame[j], l2DeformFrame[j + 1], geom.helpPointA);
            deformFrame.vertices[j] = geom.helpPointA.x - pose[j];
            deformFrame.vertices[j + 1] = geom.helpPointA.y - pose[j + 1];
        }
        else { // Offset.
            deformFrame.vertices[j] = l2DeformFrame[j] - pose[j] - modelConfig.modelImpl.stageWidth * 0.5;
            deformFrame.vertices[j + 1] = l2DeformFrame[j + 1] - pose[j + 1] - modelConfig.modelImpl.stageHeight;
        }
    }
}

function modifyFrames(frames: dbft.Frame[]): void {
    if (frames.length === 0) {
        return;
    }

    if (frames[0]._position !== 0) {
        const frame = new (frames[0] as any).constructor() as dbft.Frame;
        if (frame instanceof dbft.TweenFrame) {
            frame.tweenEasing = 0.0;
        }

        frames.unshift(frame);
    }

    for (let i = 0, l = frames.length; i < l; ++i) {
        const frame = frames[i];
        if (i < l - 1) {
            frame.duration = frames[i + 1]._position - frame._position;
        }
    }
}

function vertivesCopyFrom(result: number[], target: number[]): void {
    result.length = target.length;
    for (let i = 0, l = target.length; i < l; ++i) {
        result[i] = target[i];
    }
}

function vertivesAdd(result: number[], target: number[]): void {
    result.length = target.length;
    for (let i = 0, l = target.length; i < l; ++i) {
        result[i] += target[i];
    }
}

function vertivesMinus(result: number[], target: number[]): void {
    result.length = target.length;
    for (let i = 0, l = target.length; i < l; ++i) {
        result[i] -= target[i];
    }
}

function vertivesInterpolation(result: number[], a: number[], b: number[], t: number): void {
    result.length = a.length;

    const helper: number[] = [];
    vertivesCopyFrom(helper, b);
    vertivesMinus(helper, a);

    for (let i = 0, l = helper.length; i < l; ++i) {
        helper[i] *= t;
    }

    vertivesCopyFrom(result, a);
    vertivesAdd(result, helper);
}