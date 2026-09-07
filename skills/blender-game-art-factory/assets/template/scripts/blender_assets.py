"""Original DEADWIRE procedural asset source. Run using art_factory.py, inside Blender."""
import bpy, math, random, json, sys, hashlib, os
from pathlib import Path
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
SEED = 40721
rng = random.Random(SEED)
M = {}


def material(name, color, metallic=0.0, roughness=.7, texture=True):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if texture:
        size = 128
        img = bpy.data.images.new(name + '_weathered', size, size)
        pixels = []
        local = random.Random(SEED + sum(map(ord, name)))
        for y in range(size):
            for x in range(size):
                grain = local.random() * .22 + .84
                if name == 'fabric':
                    camo = math.sin(x*.31 + math.sin(y*.12)*2) + math.cos(y*.23 + math.sin(x*.16)*2)
                    grain *= .48 if camo > .75 else .75 if camo < -.5 else 1.05
                stain = .93 + .07 * math.sin(x * .11 + math.sin(y * .13) * 3)
                scratch = .70 if (x * 37 + y * 13) % 421 < 2 else 1
                if name in ('steel', 'olive', 'slate', 'oxide') and (x * 29 + y * 17) % 191 < 4:
                    pixels.extend((.20, .105, .051, 1))
                else:
                    pixels.extend((*[max(0, min(1, c * grain * stain * scratch)) for c in color], 1))
        img.pixels = pixels
        img.pack()
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = img
        mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    M[name] = mat
    return mat


def make_materials():
    for name, col, metal, rough in [
        ('olive', (.24, .275, .18), .45, .69), ('slate', (.16, .205, .215), .6, .62),
        ('steel', (.24, .255, .25), .85, .43), ('darksteel', (.048, .058, .060), .7, .56),
        ('rubber', (.018, .022, .021), .0, .89), ('fabric', (.12, .15, .10), .0, .98),
        ('webbing', (.255, .235, .16), .0, .95), ('skin', (.38, .28, .20), .0, .83),
        ('concrete', (.40, .405, .36), .0, .96), ('wood', (.24, .16, .085), .0, .93),
        ('ivory', (.67, .65, .54), .1, .65), ('oxide', (.36, .145, .065), .5, .72),
        ('red', (.48, .055, .028), .0, .55), ('glass', (.027, .072, .083), .8, .18),
        ('amber', (.65, .29, .035), .15, .4), ('lamp', (.82, .73, .5), .0, .24),
    ]:
        material(name, col, metal, rough, name not in ('glass', 'lamp'))


def assign(obj, mat, group='body'):
    if obj.type == 'MESH' and not obj.data.uv_layers:
        uv = obj.data.uv_layers.new(name='UVMap')
        for poly in obj.data.polygons:
            axes = [i for i in range(3) if i != max(range(3), key=lambda a: abs(poly.normal[a]))]
            for loop_index in poly.loop_indices:
                co = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = ((co[axes[0]]+1)*.5, (co[axes[1]]+1)*.5)
    obj.data.materials.append(M[mat])
    obj['part_group'] = group
    return obj


def box(name, loc, size, mat='olive', bevel=.02, group='body', rot=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    if rot: obj.rotation_euler = rot
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel and name != 'corrugation':
        mod = obj.modifiers.new('Manufactured edge', 'BEVEL')
        mod.width = min(bevel, min(size) * .22)
        mod.segments = 1 if name in ('corrugation', 'roof_ridge') else 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod = obj.modifiers.new('Weighted corners', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return assign(obj, mat, group)


def cylinder(name, loc, radius, depth, mat='steel', axis='Z', vertices=16, group='body'):
    rot = {'Z': (0, 0, 0), 'Y': (math.pi/2, 0, 0), 'X': (0, math.pi/2, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj=bpy.context.object
    obj.name=name
    bevel=obj.modifiers.new('Edge catchlight','BEVEL'); bevel.width=min(.008,radius*.08); bevel.segments=1
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    for poly in obj.data.polygons: poly.use_smooth=len(poly.vertices)==4
    return assign(obj, mat, group)


def ellipsoid(name, loc, scale, mat='fabric', group='body'):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=loc)
    obj=bpy.context.object; obj.name=name; obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in obj.data.polygons: p.use_smooth=True
    return assign(obj, mat, group)


def limb(name, start, end, radius, mat='fabric', group='body', taper=1):
    a,b=Vector(start),Vector(end); vec=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=radius*taper, depth=vec.length, location=(a+b)*.5)
    obj=bpy.context.object; obj.name=name; obj.rotation_euler=vec.to_track_quat('Z','Y').to_euler()
    for p in obj.data.polygons: p.use_smooth=len(p.vertices)==4
    return assign(obj, mat, group)


def text_label(body, loc, size=.1, rot=(math.pi/2,0,0), mat='ivory'):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj=bpy.context.object; obj.name='marking_'+body; obj.data.body=body; obj.data.size=size; obj.data.extrude=.0005
    obj.data.resolution_u=2; obj.data.align_x='CENTER'
    bpy.ops.object.convert(target='MESH')
    return assign(bpy.context.object,mat)


def rifle():
    box('upper_receiver',(0,0,.155),(.085,.35,.105),'darksteel',.012)
    box('lower_receiver',(0,-.06,.095),(.078,.20,.065),'steel',.008)
    box('buffer_tube',(0,-.25,.165),(.046,.19,.042),'darksteel',.008)
    box('adjustable_stock',(0,-.355,.13),(.095,.19,.15),'olive',.015)
    box('rubber_buttpad',(0,-.458,.13),(.1,.025,.155),'rubber',.007)
    box('stock_cheek',(0,-.34,.20),(.082,.21,.029),'rubber',.007)
    box('handguard',(0,.245,.16),(.079,.22,.081),'olive',.008)
    for i in range(7):
        for x in [-.040,.040]: box('handguard_vent',(x,.17+i*.025,.165),(.004,.015,.023),'rubber',.001)
    cylinder('barrel',(0,.445,.164),.017,.22,'darksteel','Y')
    cylinder('muzzle_brake',(0,.567,.164),.023,.048,'steel','Y')
    box('pistol_grip',(0,-.118,.025),(.058,.078,.13),'rubber',.008,rot=(.24,0,0))
    box('magazine',(0,.03,.009),(.059,.10,.205),'olive',.012,rot=(-.13,0,0))
    for x in [-.032,.032]:
        for y in [.008,.037,.066]: box('magazine_rib',(x,y,-.002),(.005,.008,.13),'darksteel',.001)
    for i in range(19): box('top_rail',(0,-.135+i*.026,.214),(.066,.014,.014),'steel',.001)
    cylinder('selector',(.047,-.088,.116),.012,.008,'steel','X',vertices=8)
    box('ejection_port',(.046,-.015,.171),(.005,.082,.024),'rubber',.001)
    box('charging_handle',(0,-.177,.18),(.118,.018,.018),'steel',.003)
    box('trigger_guard',(0,-.07,.037),(.056,.065,.012),'darksteel',.003)
    # Independent glTF nodes, toggled by equipment selection.
    box('optic_mount',(0,.005,.23),(.067,.08,.029),'darksteel',.004,'optic')
    box('reflex_housing',(0,.015,.281),(.083,.054,.080),'darksteel',.01,'optic')
    box('reflex_lens',(0,.044,.29),(.064,.004,.055),'glass',.002,'optic')
    cylinder('suppressor_tube',(0,.647,.164),.033,.145,'darksteel','Y',20,'suppressor')
    for y in [.59,.64,.695]: cylinder('suppressor_band',(0,y,.164),.034,.008,'steel','Y',20,'suppressor')


def soldier():
    # Anatomical 1.82m clothed patrolman, hip/shoulder pivot groups retained.
    box('pelvis',(0,0,.96),(.28,.19,.19),'fabric',.06)
    for side,x in [('l',-.115),('r',.115)]:
        group='leg_'+side
        limb('thigh',(x,0,.96),(x,.015,.54),.094,'fabric',group,.86)
        ellipsoid('knee',(x,.03,.54),(.084,.088,.077),'fabric',group)
        limb('calf',(x,.015,.52),(x,-.01,.17),.073,'fabric',group,.94)
        box('knee_pad',(x,.099,.53),(.11,.034,.14),'olive',.029,group)
        box('boot',(x,.03,.078),(.15,.26,.13),'rubber',.03,group)
        box('boot_sole',(x,.038,.023),(.154,.27,.029),'darksteel',.005,group)
        for z in [.22,.29]: box('cargo_strap',(x,0,z),(.137,.133,.014),'webbing',.003,group)
        box('thigh_pocket',(x+(-.07 if x<0 else .07),.003,.76),(.055,.13,.15),'webbing',.012,group)
    ellipsoid('chest',(0,0,1.285),(.20,.135,.29),'fabric')
    box('armor_front',(0,.107,1.27),(.29,.078,.30),'olive',.028)
    box('armor_back',(0,-.13,1.28),(.285,.075,.31),'olive',.03)
    for x in [-.10,0,.10]:
        box('magazine_pouch',(x,.172,1.22),(.085,.070,.16),'webbing',.011)
        box('pouch_flap',(x,.211,1.278),(.079,.009,.04),'fabric',.005)
    for x in [-.116,.116]:
        box('shoulder_webbing',(x,.025,1.477),(.056,.24,.022),'webbing',.007)
    box('belt',(0,0,1.01),(.30,.212,.043),'darksteel',.007)
    box('belt_buckle',(0,.113,1.01),(.045,.009,.027),'steel',.002)
    box('patrol_pack',(0,-.208,1.29),(.245,.135,.32),'fabric',.04)
    box('pack_flap',(0,-.284,1.37),(.23,.025,.092),'webbing',.012)
    cylinder('neck',(0,0,1.536),.058,.10,'skin')
    ellipsoid('balaclava',(0,.006,1.665),(.105,.108,.137),'fabric')
    ellipsoid('helmet_shell',(0,-.004,1.75),(.132,.139,.091),'olive')
    box('helmet_rim',(0,.009,1.72),(.237,.227,.018),'darksteel',.015)
    box('goggles',(0,.111,1.681),(.17,.035,.052),'rubber',.013)
    box('goggle_lens',(0,.132,1.684),(.15,.012,.032),'glass',.008)
    box('face_mask',(0,.09,1.611),(.12,.067,.065),'webbing',.018)
    for side,x in [('l',-.225),('r',.225)]:
        group='arm_'+side
        ellipsoid('shoulder',(x,0,1.433),(.093,.095,.108),'fabric',group)
        elbow=(x*1.13,.04,1.17)
        wrist=(x*.53,.24,1.17 if side=='l' else 1.13)
        limb('upper_arm',(x,0,1.42),elbow,.076,'fabric',group,1.05)
        ellipsoid('elbow',elbow,(.069,.071,.067),'olive',group)
        limb('forearm',elbow,wrist,.062,'fabric',group,1.15)
        ellipsoid('glove',wrist,(.052,.067,.053),'rubber',group)
        box('patch',(x+(-.06 if x<0 else .06),.02,1.38),(.015,.092,.074),'webbing',.008,group)
    # compact duty weapon in ready stance, all parts joined with body material batches
    box('duty_receiver',(.01,.285,1.165),(.065,.28,.084),'darksteel',.008)
    box('duty_stock',(.01,.071,1.16),(.07,.20,.10),'olive',.008)
    box('duty_guard',(.01,.49,1.165),(.063,.19,.066),'olive',.006)
    cylinder('duty_barrel',(.01,.646,1.165),.012,.15,'darksteel','Y',12)
    box('duty_mag',(.01,.29,1.078),(.042,.067,.14),'darksteel',.005,rot=(-.17,0,0))
    box('duty_sight',(.01,.26,1.236),(.042,.044,.04),'darksteel',.006)


def crate():
    box('crate_body',(0,0,.47),(1.02,.66,.90),'olive',.037)
    box('lid',(0,0,.935),(1.045,.685,.075),'olive',.016)
    for x in [-.46,.46]:
        for y in [-.305,.305]: box('corner_steel',(x,y,.47),(.078,.075,.87),'steel',.009)
    for x in [-.29,.29]:
        box('latch',(x,.349,.82),(.07,.024,.15),'steel',.006)
        box('lid_reinforcement',(x,0,.98),(.048,.64,.012),'darksteel',.002)
    for y in [-.34,.34]: box('handle',(0,y,.55),(.24,.025,.05),'darksteel',.006)
    for z in [.16,.35,.60,.75]: box('case_rib',(0,-.341,z),(.80,.018,.022),'darksteel',.003)
    text_label('DW / 04', (0,.343,.36),.083,(math.pi/2,0,math.pi))


def container():
    box('container_skin',(0,0,1.30),(12,2.5,2.6),'slate',.024)
    for x in [-5.91,5.91]:
        for y in [-1.215,1.215]:
            box('corner_post',(x,y,1.3),(.18,.15,2.6),'steel',.015)
            for z in [.08,2.52]: box('stacking_block',(x,y,z),(.20,.18,.16),'darksteel',.016)
    for y in [-1.26,1.26]:
        for z in [.095,2.50]: box('side_rail',(0,y,z),(11.86,.084,.16),'steel',.014)
        for i in range(65): box('corrugation',(-5.71+i*.178,y,1.3),(.074,.037,2.27),'slate',.014)
    for x in [-6.015,6.015]:
        for y in [-.60,.60]:
            box('end_door',(x,y,1.31),(.04,1.17,2.37),'slate',.009)
            for yy in [y-.39,y+.39]:
                cylinder('locking_rod',(x+(.025 if x>0 else -.025),yy,1.3),.017,2.34,'steel')
                for z in [.40,1.94]: box('locking_lug',(x,yy,z),(.08,.06,.05),'steel',.005)
    for i in range(20): box('roof_ridge',(-5.5+i*.58,0,2.615),(.075,2.34,.022),'slate',.006)
    text_label('DEADWIRE   40721',(-3,-1.285,1.82),.20)
    text_label('LOGISTICS  /  02', (3,-1.285,.6),.13)


def barrel():
    cylinder('drum',(0,0,.49),.31,.96,'oxide','Z',24)
    for z in [.04,.28,.70,.94]: cylinder('rolled_rib',(0,0,z),.319,.031,'steel','Z',24)
    cylinder('lid',(0,0,.978),.297,.018,'oxide','Z',24)
    cylinder('bung',(.11,0,.994),.04,.016,'darksteel','Z',12)
    box('hazard_label',(0,-.311,.52),(.18,.007,.19),'ivory',.001)
    box('warning_stripe',(0,-.317,.52),(.13,.003,.028),'red',.001,rot=(0,math.pi/4,0))


def barrier():
    # Jersey barrier with chamfered slope, broad footprint.
    profile=[(-.30,0),(.30,0),(.30,.16),(.13,.64),(.11,1.02),(-.11,1.02),(-.13,.64),(-.30,.16)]
    verts=[(x,y,z) for x in [-1.05,1.05] for y,z in profile]
    faces=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    mesh=bpy.data.meshes.new('Jersey_profile'); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new('jersey_barrier',mesh); bpy.context.collection.objects.link(obj); assign(obj,'concrete')
    for x in [-.8,.8]:
        box('reflector',(x,-.133,.74),(.105,.013,.11),'amber',.005)
        box('fork_slot',(x,0,.083),(.24,.63,.10),'darksteel',.002)
    for x in [-.4,.4]: cylinder('lifting_eye',(x,0,1.035),.032,.018,'steel','X',12)


def truck():
    box('chassis',(0,0,.66),(2.08,5.60,.22),'darksteel',.04)
    box('engine_hood',(0,1.95,1.29),(2.14,1.05,.76),'olive',.045)
    box('cabin_lower',(0,.95,1.13),(2.22,1.05,.63),'olive',.035)
    box('cab_roof',(0,.77,2.37),(2.28,1.43,.13),'olive',.04)
    for x in [-1.048,1.048]:
        for y in [.18,1.40]: box('cab_pillar',(x,y,1.96),(.08,.083,.80),'olive',.012)
        box('door',(x,.78,1.38),(.071,1.11,.55),'olive',.015)
        box('door_window',(x,.81,1.97),(.028,1.00,.66),'glass',.008)
        box('door_handle',(x*1.055,.49,1.55),(.030,.15,.027),'darksteel',.004)
        box('mirror_bracket',(x*1.13,1.19,1.93),(.27,.035,.034),'steel',.003)
        box('mirror',(x*1.25,1.18,1.94),(.055,.13,.21),'darksteel',.01)
    box('windshield',(0,1.416,1.99),(1.99,.033,.65),'glass',.009)
    box('windshield_center',(0,1.439,1.99),(.037,.02,.70),'olive',.006)
    box('rear_window',(0,.15,1.98),(1.47,.025,.45),'glass',.006)
    box('flatbed',(0,-1.43,.96),(2.28,3.02,.19),'wood',.025)
    for x in [-1.11,1.11]:
        box('cargo_side',(x,-1.43,1.34),(.06,3.06,.68),'olive',.012)
        for y in [-2.79,-2.15,-1.5,-.85,-.12]: box('bed_reinforcement',(x*1.04,y,1.35),(.028,.07,.73),'steel',.004)
    box('tailgate',(0,-2.98,1.35),(2.24,.072,.7),'olive',.015)
    for x in [-.94,.94]:
        box('tail_lamp',(x,-3.024,.91),(.18,.035,.08),'red',.004)
        for y in [-2.10,-1.0,1.72]:
            cylinder('tire',(x*1.10,y,.51),.49,.30,'rubber','X',20)
            cylinder('wheel_hub',(x*1.27,y,.51),.255,.04,'steel','X',16)
            cylinder('hub_cap',(x*1.30,y,.51),.10,.05,'darksteel','X',12)
            for k in range(10):
                a=k*math.tau/10
                box('tread',(x*1.11,y+math.sin(a)*.48,.51+math.cos(a)*.48),(.32,.14,.06),'rubber',.007,rot=(a,0,0))
    box('front_bumper',(0,2.56,.70),(2.38,.15,.17),'steel',.015)
    box('grille',(0,2.49,1.31),(1.05,.033,.44),'darksteel',.008)
    for x in [-.43,-.29,-.145,0,.145,.29,.43]: box('grille_bar',(x,2.515,1.31),(.036,.016,.41),'steel',.003)
    for x in [-.81,.81]: cylinder('headlight',(x,2.495,1.39),.135,.053,'lamp','Y',16)
    box('license_plate',(0,2.654,.73),(.40,.008,.11),'ivory',.002)
    cylinder('exhaust',(-1.18,-.17,1.40),.045,1.5,'darksteel')


def workbench():
    box('bench_top',(0,0,.96),(2.30,.83,.085),'wood',.021)
    for x in [-1,1]:
        for y in [-.31,.31]: box('bench_leg',(x,y,.455),(.074,.074,.91),'steel',.01)
    box('lower_shelf',(0,0,.19),(2.12,.70,.042),'slate',.009)
    box('tool_pegboard',(0,-.36,1.39),(2.24,.045,.79),'slate',.012)
    for i in range(11):
        for j in range(4): cylinder('peg',(-1+i*.20,-.327,1.15+j*.14),.009,.011,'darksteel','Y',6)
    box('vise_base',(.72,.12,1.02),(.22,.25,.055),'steel',.01)
    box('vise_body',(.72,.12,1.105),(.15,.18,.14),'slate',.017)
    for x in [.62,.82]: box('vise_jaw',(x,.12,1.16),(.06,.20,.045),'steel',.007)
    cylinder('vise_handle',(.72,.27,1.08),.012,.29,'steel','X',10)
    for i in range(3):
        box('tool_handle',(-.70+i*.24,-.317,1.38),(.034,.035,.21),'rubber',.005)
        cylinder('tool_shaft',(-.70+i*.24,-.318,1.57),.012,.20,'steel')
    box('cutting_mat',(-.30,.08,1.005),(.74,.54,.008),'rubber',.001)
    box('toolbox',(.13,-.04,.33),(.57,.43,.25),'oxide',.022)
    cylinder('bench_lamp',(-.91,-.27,1.78),.037,.06,'lamp','Y')


def locker():
    box('locker_carcass',(0,0,.96),(.85,.57,1.91),'slate',.025)
    for x in [-.205,.205]:
        box('locker_door',(x,.294,.98),(.399,.027,1.81),'olive',.012)
        for z in [1.60,1.65,1.70,.22,.27]: box('vent',(x,.31,z),(.24,.006,.012),'darksteel',.001)
        box('handle',(x+.11,.329,1.03),(.021,.023,.14),'steel',.004)
        box('nameplate',(x,.316,1.38),(.15,.008,.052),'ivory',.003)
    for x in [-.36,.36]: box('foot',(x,0,.033),(.10,.50,.06),'darksteel',.005)


def radio():
    box('radio_case',(0,0,.185),(.43,.27,.35),'olive',.019)
    box('front_panel',(0,.142,.19),(.38,.023,.29),'darksteel',.009)
    box('screen',(-.05,.157,.255),(.19,.010,.076),'glass',.005)
    for x in [-.115,-.063,-.010,.042]: cylinder('knob',(x,.167,.13),.014,.018,'steel','Y',10)
    for x in [.106,.13,.154]:
        for z in [.20,.23,.26,.29]: box('speaker',(x,.159,z),(.014,.005,.015),'rubber',.001)
    cylinder('aerial',(-.16,-.07,.615),.008,.50,'darksteel','Z',8)
    box('carry_handle',(0,-.055,.39),(.27,.034,.034),'rubber',.005)
    for x in [-.12,.12]: box('handle_riser',(x,-.055,.365),(.03,.035,.07),'rubber',.005)


def medkit():
    box('medical_pouch',(0,0,.135),(.31,.20,.25),'webbing',.042)
    box('zipper',(0,0,.26),(.27,.018,.010),'darksteel',.002)
    box('patch',(0,.104,.145),(.118,.01,.105),'fabric',.005)
    box('cross_vertical',(0,.111,.145),(.025,.003,.083),'ivory',.001)
    box('cross_horizontal',(0,.112,.145),(.082,.003,.025),'ivory',.001)
    for x in [-.10,.10]: box('molle_strap',(x,-.107,.125),(.027,.018,.18),'fabric',.005)


def backpack():
    box('pack',(0,0,.32),(.43,.25,.62),'fabric',.065)
    box('top_flap',(0,.025,.60),(.42,.29,.095),'webbing',.025)
    box('front_pocket',(0,.158,.28),(.34,.12,.32),'webbing',.03)
    for x in [-.145,.145]:
        box('compression_strap',(x,.224,.34),(.034,.01,.34),'darksteel',.003)
        box('buckle',(x,.231,.45),(.045,.012,.043),'steel',.004)
        box('shoulder_strap',(x,-.147,.35),(.052,.044,.40),'rubber',.014)
    for z in [.16,.22,.28]: box('molle_row',(0,.225,z),(.28,.015,.022),'fabric',.005)
    box('grab_loop',(0,-.02,.669),(.17,.032,.029),'darksteel',.005)


def generator():
    box('generator_base',(0,0,.14),(1.15,.70,.17),'darksteel',.02)
    box('generator_engine',(-.16,0,.49),(.54,.49,.54),'steel',.031)
    box('fuel_tank',(.20,0,.65),(.42,.49,.32),'oxide',.024)
    cylinder('alternator',(.31,0,.35),.23,.33,'darksteel','X',20)
    for x in [-.51,.51]:
        for y in [-.30,.30]:
            cylinder('frame_upright',(x,y,.44),.023,.75,'darksteel')
        cylinder('frame_crossbar',(x,0,.82),.023,.60,'darksteel','Y')
    for y in [-.30,.30]: cylinder('frame_top',(0,y,.82),.023,1.03,'darksteel','X')
    box('control_panel',(-.18,.263,.52),(.39,.030,.29),'darksteel',.007)
    for x in [-.27,-.13]: cylinder('socket',(x,.286,.52),.035,.020,'rubber','Y',12)
    cylinder('fuel_cap',(.20,0,.825),.05,.025,'darksteel','Z',12)
    for i in range(8): box('cooling_fin',(-.20,-.27,.25+i*.043),(.39,.033,.015),'steel',.002)


BUILDERS={name:globals()[name] for name in ['rifle','soldier','crate','container','barrel','barrier','truck','workbench','locker','radio','medkit','backpack','generator']}
PIVOTS={'leg_l':(-.115,0,.96),'leg_r':(.115,0,.96),'arm_l':(-.225,0,1.433),'arm_r':(.225,0,1.433)}


def merge_parts():
    buckets={}
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH': buckets.setdefault((obj.get('part_group','body'),obj.data.materials[0].name),[]).append(obj)
    groups={}
    for group in sorted(set(k[0] for k in buckets)):
        empty=bpy.data.objects.new(group,None); bpy.context.collection.objects.link(empty); empty.location=PIVOTS.get(group,(0,0,0)); groups[group]=empty
    for (group,mat),objects in buckets.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        
        if len(objects)>1: bpy.ops.object.join()
        obj=bpy.context.object; obj.name=group+'_'+mat
        world=obj.matrix_world.copy(); obj.parent=groups[group]; obj.matrix_world=world
    return groups


def bounds():
    points=[obj.matrix_world@Vector(c) for obj in bpy.context.scene.objects if obj.type=='MESH' for c in obj.bound_box]
    minimum=[min(p[i] for p in points) for i in range(3)]; maximum=[max(p[i] for p in points) for i in range(3)]
    return minimum,maximum


def camera_and_light(minimum,maximum):
    center=Vector([(a+b)/2 for a,b in zip(minimum,maximum)])
    extent=max(b-a for a,b in zip(minimum,maximum))
    bpy.ops.object.camera_add(location=center+Vector((1.45,1.8,1.05))*extent)
    camera=bpy.context.object; camera.name='review_camera'; camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=extent*1.40
    bpy.context.scene.camera=camera
    for location,power,size in [(center+Vector((1,-1,2))*extent,900,extent*1.8),(center+Vector((-1,1,1))*extent,650,extent*1.2),(center+Vector((0,1,2))*extent,700,extent)]:
        bpy.ops.object.light_add(type='AREA',location=location)
        light=bpy.context.object; light.data.energy=power*.36*extent*extent; light.data.shape='DISK'; light.data.size=size; light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene
    scene.world.color=(.16,.16,.16)
    scene.render.engine='CYCLES'; scene.cycles.samples=20; scene.cycles.use_denoising=True; scene.cycles.device='CPU'
    scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
    scene.world.use_nodes=True; scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.065,.073,.076,1)
    scene.view_settings.view_transform='AgX'


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def build(asset_id):
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    BUILDERS[asset_id]()
    merge_parts()
    bpy.context.view_layer.update()
    minimum,maximum=bounds()
    # Ground rifle too; empties remain in glTF identity orientation.
    if minimum[2] < -.0001:
        for obj in bpy.context.scene.objects:
            if obj.parent is None: obj.location.z -= minimum[2]
        bpy.context.view_layer.update(); minimum,maximum=bounds()
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    tris=0
    for o in meshes:o.data.calc_loop_triangles(); tris+=len(o.data.loop_triangles)
    glb=ROOT/'assets/candidates'/f'{asset_id}.glb'; blend=ROOT/'assets/source'/f'{asset_id}.blend'
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
    camera_and_light(minimum,maximum)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend),check_existing=False)
    bpy.context.scene.render.filepath=str(ROOT/'assets/previews'/f'{asset_id}.png')
    bpy.ops.render.render(write_still=True)
    result={'id':asset_id,'candidate':str(glb.relative_to(ROOT)),'source':str(blend.relative_to(ROOT)),'preview':f'assets/previews/{asset_id}.png','dimensions':{'x':round(maximum[0]-minimum[0],4),'y':round(maximum[2]-minimum[2],4),'z':round(maximum[1]-minimum[1],4)},'triangles':tris,'meshCount':len(meshes),'materialCount':len(set(m.name for o in meshes for m in o.data.materials)),'nodes':[o.name for o in bpy.context.scene.objects if o.type=='EMPTY'],'sourceSha256':sha(blend),'outputSha256':sha(glb),'previewSha256':sha(ROOT/'assets/previews'/f'{asset_id}.png'),'bytes':glb.stat().st_size,'provenance':{'origin':'Original deterministic procedural geometry and pixel textures authored for DEADWIRE','license':'CC0-1.0','tool':'Blender','toolVersion':bpy.app.version_string,'seed':SEED,'generator':'scripts/blender_assets.py','generatorSha256':sha(__file__)},'status':'candidate','technicalValidation':None,'visualReview':None}
    (ROOT/'assets/candidates'/f'{asset_id}.json').write_text(json.dumps(result,indent=2)+'\n')
    print('ASSET_BUILT '+asset_id+' '+str(tris)+' triangles',flush=True)


if __name__=='__main__':
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    make_materials()
    for asset in (args or list(BUILDERS)):build(asset)
    # os._exit avoids hanging audio teardown on headless desktop hosts after files are flushed.
    sys.stdout.flush(); sys.stderr.flush(); os._exit(0)
