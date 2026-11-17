# References

The methods, physical models, data and third-party assets behind Infinitex.
Each entry gives the source, then where the code uses it.

DOIs were checked against Crossref or DataCite. URLs were checked to resolve.
Entries marked "(unverified)" could not be checked against a database: their
details come from the literature as commonly cited. Some entries are well-known
methods the code implements without naming them; they are listed so a reader
can find the theory.

## Level of detail and filtering

- M. Toksvig. Mipmapping Normal Maps. Journal of Graphics Tools 10(3), 2005. https://doi.org/10.1080/2151237X.2005.10129203
  Used in: `src/core/lod.js` (`composeRoughness`: a faded level hands its slope variance to the roughness), `src/families/knit/stitch.js` (normal lost by averaging goes into roughness).

- M. Olano, D. Baker. LEAN Mapping. Proceedings of the 2010 ACM SIGGRAPH Symposium on Interactive 3D Graphics and Games (I3D), 2010. https://doi.org/10.1145/1730804.1730834
  Used in: `src/core/lod.js` (same idea: slope variance of unresolved detail widens the specular lobe).

- A. S. Kaplanyan, S. Hill, A. Patney, A. Lefohn. Filtering Distributions of Normals for Shading Antialiasing. High-Performance Graphics, 2016. https://doi.org/10.2312/hpg.20161201
  Used in: `src/core/lod.js` (`specularAA`: roughness widened by the screen-space change of the normal).

- Y. Tokuyoshi, A. S. Kaplanyan. Improved Geometric Specular Antialiasing. ACM SIGGRAPH Symposium on Interactive 3D Graphics and Games (I3D), 2019. https://doi.org/10.1145/3306131.3317026
  Used in: `src/core/lod.js` (`specularAA`, simplified: variance 0.25, clamp 0.18 on alpha squared), called by every family.

- J. Lengyel, E. Praun, A. Finkelstein, H. Hoppe. Real-Time Fur over Arbitrary Surfaces. Symposium on Interactive 3D Graphics (I3D), 2001. https://doi.org/10.1145/364338.364407
  Used in: `src/families/knit/fuzz.js` and `src/index.js` (`createFuzz`: stray fibres drawn as stacked shells).

## Shading models

- T. S. Trowbridge, K. P. Reitz. Average irregularity representation of a rough surface for ray reflection. Journal of the Optical Society of America 65(5), 1975. https://doi.org/10.1364/JOSA.65.000531
  Used in: `src/core/lod.js` (the GGX / Trowbridge-Reitz lobe whose alpha squared the LOD widens), through three.js `MeshPhysicalNodeMaterial`.

- B. Walter, S. R. Marschner, H. Li, K. E. Torrance. Microfacet Models for Refraction through Rough Surfaces. Eurographics Symposium on Rendering, 2007. https://doi.org/10.2312/EGWR/EGSR07/195-206
  Used in: `src/core/lod.js` (GGX microfacet distribution of every family).

- P. Beckmann, A. Spizzichino. The Scattering of Electromagnetic Waves from Rough Surfaces. Pergamon Press, 1963. (unverified)
  Used in: `src/core/lod.js` (alpha squared += 2 x slope variance: the Beckmann relation between roughness and slope variance).

- B. Burley. Physically-Based Shading at Disney. SIGGRAPH 2012 course: Practical Physically Based Shading in Film and Game Production. https://blog.selfshadow.com/publications/s2012-shading-course/
  Used in: `src/core/lod.js` (perceptual roughness r, alpha = r squared, so alpha squared = r^4).

- C. Schlick. An Inexpensive BRDF Model for Physically-based Rendering. Computer Graphics Forum 13(3), 1994. https://doi.org/10.1111/1467-8659.1330233
  Used in: `src/families/liquid/sky.js` (Fresnel factor of the sky reflection), and three.js Fresnel in every material.

- A. Estevez, C. Kulla. Production Friendly Microfacet Sheen BRDF. Sony Pictures Imageworks technical report, SIGGRAPH 2017 course. https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_sheen.pdf
  Used in: `src/index.js` (fuzz shells carry the sheen the base gives up), `sheenNode` of the fibre, plant and ceramic families (three.js "Charlie" sheen).

- C. Kulla, A. Conty. Revisiting Physically Based Shading at Imageworks. SIGGRAPH 2017 course: Physically Based Shading in Theory and Practice. https://blog.selfshadow.com/publications/s2017-shading-course/
  Khronos Group. KHR_materials_anisotropy, glTF 2.0 extension. https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_anisotropy
  Used in: `src/families/metal/shader.js` (`anisotropyNode` of brushed metal; three.js uses alphaT = mix(alpha, 1, anisotropy squared), see `docs/materials.md`).

- L. Belcour, P. Barla. A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence. ACM Transactions on Graphics 36(4), SIGGRAPH 2017. https://doi.org/10.1145/3072959.3073620
  Khronos Group. KHR_materials_iridescence, glTF 2.0 extension. https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_iridescence
  Used in: `src/families/scifi/shader.js` and `scifi/foil.js` (iridescence lobe), `src/families/plant/shader.js` (nacre), `src/families/scales/shader.js` (scale iridescence), `src/families/organic/extras.js`, `src/families/molten/shader.js` (slag tarnish), through three.js `iridescenceNode`.

- C. Barré-Brisebois, M. Bouchard. Approximating Translucency for a Fast, Cheap and Convincing Subsurface Scattering Look. GDC 2011. https://www.colinbarrebrisebois.com/2011/03/07/gdc-2011-approximating-translucency-for-a-fast-cheap-and-convincing-subsurface-scattering-look/
  Used in: `src/index.js` (`MeshSSSNodeMaterial` for skin and marble), `src/families/skin/shader.js`.

- D. Chan. Material Advances in Call of Duty: WWII. SIGGRAPH 2018 course: Advances in Real-Time Rendering in Games. https://advances.realtimerendering.com/s2018/index.htm
  Used in: `src/core/microshadow.js` (micro-shadowing: clamp(|N.L| + 2 ao^2 - 1, 0, 1), on every material).

- R. R. Anderson, J. A. Parrish. The Optics of Human Skin. Journal of Investigative Dermatology 77(1), 1981. https://doi.org/10.1111/1523-1747.ep12479191
  J. Jimenez, T. Scully, N. Barbosa, C. Donner, X. Alvarez, T. Vieira, P. Matts, V. Orvalho, D. Gutierrez, T. Weyrich. A Practical Appearance Model for Dynamic Facial Color. ACM Transactions on Graphics 29(6), SIGGRAPH Asia 2010. https://doi.org/10.1145/1882261.1866167
  Used in: `src/families/skin/params.js` and `skin/shader.js` (skin colour from two chromophores, melanin and hemoglobin).

## Hair

- J. T. Kajiya, T. L. Kay. Rendering Fur with Three Dimensional Textures. SIGGRAPH 1989, Computer Graphics 23(3). https://doi.org/10.1145/74334.74361
  Used in: `src/core/hair3d_shade.js` (highlight along the strand), `src/families/pile/velvet.js` (fibres lit along their axis reflect little).

- S. R. Marschner, H. W. Jensen, M. Cammarano, S. Worley, P. Hanrahan. Light Scattering from Human Hair Fibers. ACM Transactions on Graphics 22(3), SIGGRAPH 2003. https://doi.org/10.1145/882262.882345
  Used in: `src/core/hair3d_shade.js` (TT lobe: backlit translucency; TRT: second coloured highlight shifted toward the root).

- T. Scheuermann. Practical Real-Time Hair Rendering and Shading. ACM SIGGRAPH 2004 Sketches. https://doi.org/10.1145/1186223.1186408
  Used in: `src/core/hair3d_shade.js` (two shifted Kajiya-Kay style highlights, the real-time form of R and TRT; not cited in the code).

- T. Lokovic, E. Veach. Deep Shadow Maps. SIGGRAPH 2000. https://doi.org/10.1145/344779.344958
  C. Yuksel, J. Keyser. Deep Opacity Maps. Computer Graphics Forum 27(2), Eurographics 2008. https://doi.org/10.1111/j.1467-8659.2008.01165.x
  Used in: `src/core/hair3d_shade.js` (self-shadow of the hair layer: transmittance exp(-tau depth / cos), the analytic slab form of deep opacity).

## Noise and hashing

- D. Hoskins. Hash without Sine. Shadertoy, 2014. https://www.shadertoy.com/view/4djSRW (unverified: the page blocks scripted access)
  Used in: `src/core/hash.js` (`hash1`, `hash3`: the 0.1031 / 33.33 hashes), so every family.

- K. Perlin. An Image Synthesizer. SIGGRAPH 1985, Computer Graphics 19(3). https://doi.org/10.1145/325165.325247
  K. Perlin. Improving Noise. ACM Transactions on Graphics 21(3), SIGGRAPH 2002. https://doi.org/10.1145/566654.566636
  Used in: `src/core/hash.js` (`valueNoise`, smoothstep-weighted lattice noise in the same lineage), `src/families/knit/yarn.js` (`mx_noise_float`, gradient noise).

- D. S. Ebert, F. K. Musgrave, D. Peachey, K. Perlin, S. Worley. Texturing and Modeling: A Procedural Approach, 3rd edition. Morgan Kaufmann, 2003. ISBN 978-1-55860-848-1.
  Used in: `src/families/stone/common.js` (`fbm`, octaves faded by the footprint), `src/families/organic/common.js` (`ridged` multifractal), `src/core/front.js` (fractal wiggle of a front).

- Academy Software Foundation. MaterialX Specification. https://materialx.org/Specification.html
  Used in: `src/families/knit/yarn.js`, `src/families/knit/shader.js` (`mx_noise_float`, `mx_cell_noise_float` from three.js TSL).

- S. Worley. A Cellular Texture Basis Function. SIGGRAPH 1996. https://doi.org/10.1145/237170.237267
  Used in: `src/core/voronoi.js` (nearest and second seed, 3 x 3 search), so leather, scales, cracks, crystals, pebbles, cork, bark.

- I. Quilez. Voronoi edges. https://iquilezles.org/articles/voronoilines/
  Used in: `src/core/voronoi.js` (distance to the shared border measured to the bisector).

- F. Aurenhammer. Voronoi Diagrams: A Survey of a Fundamental Geometric Data Structure. ACM Computing Surveys 23(3), 1991. https://doi.org/10.1145/116873.116880
  W. A. Johnson, R. F. Mehl. Reaction Kinetics in Processes of Nucleation and Growth. Transactions of the AIME 135, 1939. (unverified)
  Used in: `src/core/front.js` (additively weighted Voronoi: seeds that start at different times, the Johnson-Mehl growth model), `src/families/transform/` (burn, ink, mould, dry, rust, melt).

- K. Perlin, E. M. Hoffert. Hypertexture. SIGGRAPH 1989, Computer Graphics 23(3). https://doi.org/10.1145/74334.74359
  I. Quilez. Domain warping. https://iquilezles.org/articles/warp/
  Used in: `src/families/organic/common.js` (`warp2`), `src/families/woven/shader.js` (hand irregularity), `src/families/pile/velvet.js` (crushed patches), `src/families/organic/husk.js`.

- I. Quilez. Smooth minimum. https://iquilezles.org/articles/smin/
  Used in: `src/families/ground/grains.js` (rounded grains), `src/families/metal/hammered.js` (craters), `src/families/skin/shader.js` (skin plateaus).

- H. Vogel. A Better Way to Construct the Sunflower Head. Mathematical Biosciences 44(3-4), 1979. https://doi.org/10.1016/0025-5564(79)90080-4
  Used in: `src/families/liquid/waves.js` (golden-angle wave directions, so no two waves line up).

## Optics and colour

- CIE. CIE 015:2018 Colorimetry, 4th edition. https://doi.org/10.25039/TR.015.2018
  Used in: `src/core/optics.js` (`spectral` approximates the colour of pure wavelengths), `src/families/molten/heat.js` (blackbody chroma fitted on the CIE table).

- A. Zucconi. Improving the Rainbow, Part 2. 2017. https://www.alanzucconi.com/2017/07/15/improving-the-rainbow-2/
  Used in: `src/core/optics.js` (`spectral`: the six-bump fit), so `thinfilm.js`, opal, hologram, crystal.

- M. Born, E. Wolf. Principles of Optics, 7th edition. Cambridge University Press, 1999. https://doi.org/10.1017/CBO9781139644181
  Used in: `src/core/thinfilm.js` (two-beam thin-film reflectance, path difference 2 n d cos t), `src/core/watersurface.js` and `demo/aquarium.js` (Snell's law, critical angle, total internal reflection, Snell's window), `src/core/refraction.js` (Snell at a flat interface: apparent depth, the broken stick, a pane's magnification), `src/core/waterline.js` (total internal reflection in the meniscus), `src/families/scifi/hologram.js` (grating equation), `src/core/states_shape.js` (a drop as a lens).

- A. Michel-Lévy, A. Lacroix. Les minéraux des roches. Baudry, Paris, 1888. (unverified)
  B. E. Sørensen. A revised Michel-Lévy interference colour chart based on first-principles calculations. European Journal of Mineralogy 25(1), 2013. https://doi.org/10.1127/0935-1221/2013/0025-2252
  Used in: `src/core/optics.js` (`interference`: sin^2(pi R / lambda) between crossed polarisers), `src/families/scifi/crystal.js`.

- P.-G. de Gennes, J. Prost. The Physics of Liquid Crystals, 2nd edition. Oxford University Press, 1993. https://doi.org/10.1093/oso/9780198520245.001.0001
  Used in: `src/families/scifi/crystal.js` (nematic schlieren texture: sin^2(2 theta) brushes, half-integer and integer defects).

- W. H. Bragg, W. L. Bragg. The Reflection of X-rays by Crystals. Proceedings of the Royal Society A 88(605), 1913. https://doi.org/10.1098/rspa.1913.0040
  J. V. Sanders. Colour of Precious Opal. Nature 204, 1964. https://doi.org/10.1038/2041151a0
  Used in: `src/families/scifi/opal.js` (lambda = 2 n d cos theta, silica spheres, n = 1.45).

- P. Vukusic, J. R. Sambles, C. R. Lawrence, R. J. Wootton. Quantified Interference and Diffraction in Single Morpho Butterfly Scales. Proceedings of the Royal Society B 266(1427), 1999. https://doi.org/10.1098/rspb.1999.0794
  S. Kinoshita, S. Yoshioka, K. Kawagoe. Mechanisms of Structural Colour in the Morpho Butterfly: Cooperation of Regularity and Irregularity in an Iridescent Scale. Proceedings of the Royal Society B 269(1499), 2002. https://doi.org/10.1098/rspb.2002.2019
  Used in: `src/families/organic/insect.js` (structural blue of the morpho wing, violet at grazing views).

- D. L. Monroe, B. L. Monroe. Origin of Iridescent Colors on the Indigo Snake. Science 159(3810), 1968. https://doi.org/10.1126/science.159.3810.97-a (Crossref also lists the suffix `.b`)
  Used in: `src/families/scales/shader.js` (micro ridges a few microns apart diffract light into colours).

- M. Planck. Ueber das Gesetz der Energieverteilung im Normalspectrum. Annalen der Physik 309(3), 1901. https://doi.org/10.1002/andp.19013090310
  W. Wien. Ueber die Energievertheilung im Emissionsspectrum eines schwarzen Körpers. Annalen der Physik 294(8), 1896. https://doi.org/10.1002/andp.18962940803
  Used in: `src/families/molten/heat.js` (brightness from the Wien approximation at 620 nm, c2 / lambda = 23200 K), `src/families/transform/heat.js` (ember glow).

- M. Charity. What color is a blackbody? Some pixel rgb values. http://www.vendian.org/mncharity/dir3/blackbody/
  T. Helland. How to Convert Temperature (K) to RGB: Algorithm and Sample Code. 2012. https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
  Used in: `src/families/transform/heat.js` (`blackbody`: Helland's log fit, scaled to 0..1, itself fitted on Charity's table), `src/families/molten/heat.js` (own exponential fit; matches Charity's linear sRGB values at 1000 to 3000 K).

- A. Beer. Bestimmung der Absorption des rothen Lichts in farbigen Flüssigkeiten. Annalen der Physik 162(5), 1852. https://doi.org/10.1002/andp.18521620505
  J. H. Lambert. Photometria. Augsburg, 1760. (unverified)
  Used in: `src/families/ceramic/glaze.js`, `src/families/organic/blood.js`, `organic/mucus.js`, `src/families/transform/ink.js`, `src/families/skin/shader.js` (absorption adds up), `src/core/underwater.js` (exp(-sigma D)).

- J. Lekner, M. C. Dorf. Why Some Things Are Darker When Wet. Applied Optics 27(7), 1988. https://doi.org/10.1364/AO.27.001278
  Used in: `src/core/surface.js` (wet porous matter darkens), `src/core/states_stain.js` (oil darkens and saturates a fabric).

- CIE S 011/E:2003 and ISO 15469:2004. Spatial distribution of daylight: CIE standard general sky. (unverified)
  P. Moon, D. E. Spencer. Illumination from a Non-Uniform Sky. Illuminating Engineering 37, 1942. (unverified)
  Used in: `src/families/liquid/sky.js` (overcast sky L(z) = (1 + 2 z) / 3, the zenith three times the horizon).

## Water and waves

- H. Lamb. Hydrodynamics, 6th edition. Cambridge University Press, 1932. (unverified edition details)
  Used in: `src/families/liquid/waves.js` (dispersion of gravity-capillary waves, w^2 = g k + (sigma / rho) k^3; phase and group speed), `src/families/liquid/rain.js` (ring packets at the group speed).

- N. B. Vargaftik, B. N. Volkov, L. D. Voljak. International Tables of the Surface Tension of Water. Journal of Physical and Chemical Reference Data 12(3), 1983. https://doi.org/10.1063/1.555688
  Used in: `src/families/liquid/waves.js` (`SIGMA` = 7.28e-5 m3/s2, that is 72.8 mN/m over 1000 kg/m3).

- G. G. Stokes. On the Theory of Oscillatory Waves. Transactions of the Cambridge Philosophical Society 8, 1847. Reprinted in Mathematical and Physical Papers vol. 1, https://doi.org/10.1017/CBO9780511702242.013
  Used in: `src/families/liquid/waves.js` (second harmonic -(k a^2 / 2) cos 2 arg: sharp crests), so `liquid/water.js` and `core/underwater.js`.

- J. F. Nye. Natural Focusing and Fine Structure of Light: Caustics and Wave Dislocations. Institute of Physics Publishing, 1999. ISBN 0-7503-0610-6.
  Used in: `src/core/caustics.js` (intensity 1 / |det J| with J = I + D (1 - 1/n) Hess(h); caustic lines where det J = 0), `src/families/liquid/water.js`, `src/core/underwater.js`.

- G. M. Hale, M. R. Querry. Optical Constants of Water in the 200-nm to 200-um Wavelength Region. Applied Optics 12(3), 1973. https://doi.org/10.1364/AO.12.000555
  Used in: `src/families/liquid/water.js` (`N_WATER` = 1.33), `src/core/watersurface.js`, `src/core/caustics.js`, `src/core/underwater.js`, `src/families/liquid/shader.js` (F0 of 2 %).

- R. M. Pope, E. S. Fry. Absorption Spectrum (380-700 nm) of Pure Water. II. Integrating Cavity Measurements. Applied Optics 36(33), 1997. https://doi.org/10.1364/AO.36.008710
  R. C. Smith, K. S. Baker. Optical Properties of the Clearest Natural Waters (200-800 nm). Applied Optics 20(2), 1981. https://doi.org/10.1364/AO.20.000177
  Used in: `src/core/underwater.js` (`absorb` = 0.45, 0.07, 0.02 per metre for 650, 550, 450 nm; red lost in metres, blue in tens of metres). The code does not name a source: these are the reference data for such values.

- S. G. Warren, R. E. Brandt. Optical Constants of Ice from the Ultraviolet to the Microwave: A Revised Compilation. Journal of Geophysical Research 113, D14220, 2008. https://doi.org/10.1029/2007JD009744
  Used in: `src/families/ground/ice.js` (refracted view ray, n = 1.31).

- J. Plateau. Statique expérimentale et théorique des liquides soumis aux seules forces moléculaires. Gauthier-Villars, Paris, 1873. (unverified)
  D. Weaire, S. Hutzler. The Physics of Foams. Oxford University Press, 1999. ISBN 978-0-19-850551-8.
  Used in: `src/families/liquid/foam.js` (liquid drained into Plateau borders between bubbles), `src/families/plastic/foam.js` (struts where cells meet).

- R. D. Deegan, O. Bakajin, T. F. Dupont, G. Huber, S. R. Nagel, T. A. Witten. Capillary Flow as the Cause of Ring Stains from Dried Liquid Drops. Nature 389, 1997. https://doi.org/10.1038/39827
  Used in: `src/core/states_stain.js` (tide line at the edge of a stain), `src/families/transform/ink.js` (pigment piles at the rim), `src/core/states_drops.js` (tide line of blood stains).

- E. W. Washburn. The Dynamics of Capillary Flow. Physical Review 17(3), 1921. https://doi.org/10.1103/PhysRev.17.273
  Used in: `src/families/transform/ink.js` (ink wicks through the fibres, radius growing as the square root of time).

## Materials data

- K. G. Libbrecht. The Physics of Snow Crystals. Reports on Progress in Physics 68(4), 2005. https://doi.org/10.1088/0034-4885/68/4/R03
  Used in: `src/core/states_frost.js` (hexagonal ice plates and needles of hoar frost), `src/families/ground/frost.js`.

Other sizes in the code (fibre diameters, grain sizes, pore sizes, droplet sizes, rain rates) are given without a named source. They are typical values; no reference is claimed for them.

## Rendering techniques

- T. Kaneko, T. Takahei, M. Inami, N. Kawakami, Y. Yanagida, T. Maeda, S. Tachi. Detailed Shape Representation with Parallax Mapping. ICAT 2001. (unverified)
  Used in: `src/families/knit/stitch.js` (one-probe parallax of the yarn), `src/families/ground/ice.js`, `src/families/ceramic/glass.js`, `src/families/plastic/silicone.js`, `src/families/plastic/foam.js`, `src/families/liquid/water.js` (layers seen along the view ray).

- N. Tatarchuk. Dynamic Parallax Occlusion Mapping with Approximate Soft Shadows. Symposium on Interactive 3D Graphics and Games (I3D), 2006. https://doi.org/10.1145/1111411.1111423
  F. Policarpo, M. M. Oliveira, J. L. D. Comba. Real-Time Relief Mapping on Arbitrary Polygonal Surfaces. Symposium on Interactive 3D Graphics and Games (I3D), 2005. https://doi.org/10.1145/1053427.1053453
  Used in: `src/core/relief.js` (view ray marched through the height field, linear steps then bisection, second march toward the light for self-shadows).

- M. S. Mikkelsen. Bump Mapping Unparametrized Surfaces on the GPU. Journal of Graphics, GPU, and Game Tools 15(1), 2010. https://doi.org/10.1080/2151237X.2010.10390651
  M. S. Mikkelsen. Surface Gradient-Based Bump Mapping Framework. Journal of Computer Graphics Techniques 9(3), 2020. https://jcgt.org/published/0009/03/04/ (volume and issue unverified)
  Used in: `src/core/basematerial.js` (tangent frame from screen derivatives), `src/core/lod.js` (`surfaceGradient`, `perturbNormal`), `src/core/optics.js` (`viewInCoords`).

- E. Lengyel. Oblique View Frustum Depth Projection and Clipping. 2005. https://www.terathon.com/lengyel/Lengyel-Oblique.pdf (venue unverified)
  Used in: `src/core/mirror.js` (planar mirror: three.js' reflector clips with this oblique near plane, which fails with a reversed depth buffer, so Infinitex uses a mirrored camera and a real clipping plane instead).

- N. Reed. Depth Precision Visualized. NVIDIA Developer, 2015. https://developer.nvidia.com/content/depth-precision-visualized
  Used in: `demo/scene.js` (`reversedDepthBuffer`, for microns to metres), `src/core/mirror.js`.

- L. Williams. Casting Curved Shadows on Curved Surfaces. SIGGRAPH 1978. https://doi.org/10.1145/965139.807402
  W. T. Reeves, D. H. Salesin, R. L. Cook. Rendering Antialiased Shadows with Depth Maps. SIGGRAPH 1987. https://doi.org/10.1145/37401.37435
  Used in: `demo/scene.js` (sun shadow map, `PCFSoftShadowMap`).

- J. Jimenez, X. Wu, A. Pesce, A. Jarabo. Practical Real-Time Strategies for Accurate Indirect Occlusion. Activision technical memo ATVI-TR-16-01, SIGGRAPH 2016 course. https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf
  Used in: `src/camera/post.js` (GTAO from three.js addons), `src/core/hair3d_shadow.js` (writes the surface normal so GTAO leaves strand shadows alone).

- Academy of Motion Picture Arts and Sciences. Academy Color Encoding System (ACES). https://acescentral.com (unverified URL); three.js uses the RRT and ODT fit by S. Hill, https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs
  Used in: `demo/scene.js` (`ACESFilmicToneMapping`), `src/families/transform/heat.js` (glow kept moderate for it).

## Assets and software

- Poly Haven. Kloppenheim 06, HDRI by Greg Zaal. CC0. https://polyhaven.com/a/kloppenheim_06 (licence: https://polyhaven.com/license)
  Used in: `demo/assets/hdri/kloppenheim_06_2k.hdr`, loaded by `demo/scene.js` as the environment and sky.

- three.js (r187), MIT licence. https://threejs.org, https://github.com/mrdoob/three.js
  Used in: everything (`WebGPURenderer`, TSL node materials, `GLTFLoader`, `HDRLoader`, `GTAONode`).

- Khronos Group. glTF 2.0 Specification. https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
  Used in: `src/core/basematerial.js` (metallicRoughness texture: roughness in G, metalness in B) and the game scene demos.

- Vite, MIT licence. https://vite.dev
  Used in: `package.json` (dev server and build).

- Playwright (`playwright-core`), Apache 2.0 licence. https://playwright.dev
  Used in: `tests/chromium.mjs` and the test, bench and film scripts (headless Chrome for Testing).

- FFmpeg, LGPL or GPL. https://ffmpeg.org
  Used in: `tests/film.mjs` (encodes the demo films; external tool, not bundled).

## Underwater look: a three.js demo read frame by frame

16 November 2026. A 30 s video relayed by the three.js account (x.com/threejs/status/2122361823320305680), an underwater world by Ricardo De Zoete built in The Sandbox Game Studio. No code is public. 19 frames at 1080p were read in a browser. What makes the picture, most important first:

- **Haze, not blur.** Distance is told by a dense fog of one saturated colour: at a few meters only silhouettes remain. Edges stay sharp far away. There is little or no depth of field. So under water our depth of field should stay weak, and the haze carry the depth.
- **Light shafts cut by the geometry.** Wide soft beams from the surface. In the cave shot the beam has a hard edge along the arch: it is shadowed, so either marched against the shadow map or a mesh cone fitted to the opening. In the open shots many thin streaks ride on the beams: a moving pattern (caustics or noise) multiplies them.
- **One colour per place.** Turquoise, green, blue, violet, amber: fog colour, light colour and grading change together per zone.
- **The hero stays out of the fog.** The red fish near the camera keeps its full saturation: the complement of the fog colour, so it reads at once.
- **Occlusion and cast shadows are strong.** Dark contacts under the bones and in the cracks of the rock, sharp shadows of the plants on the wall. That contrast survives the haze near the camera and gives the scale.
- **Bubbles are rings.** Bright crescents, not refracting spheres: sprites with a rim highlight.
- **The surface from below** is a bright moving pattern, no Snell window.
- **Life in instances.** Schools of small fish as flat silhouettes, jellyfish, swaying grass. Cheap, and it fills the depth.

Not in Infinitex yet: several places with their own colours in one scene, and the shadow of an object in a light shaft. Life is in the aquarium since (`demo/sealife/`, code only: three kinds of fish, jellyfish, a crab that walks on the dunes, seagrass, kelp, anemones, corals, starfish). Done since: light shafts that follow the caustics (`src/core/shafts.js`), ring bubbles (`src/core/bubbles.js`), half the blur under water. Done after this reading: the eye's own share under water (`src/core/underlens.js`), AO and depth of field on the aquarium (`src/camera/targetpost.js`).

### Mood of the aquarium: a sunlit reef in an animated film

17 November 2026. Before, the tank was one flat turquoise: one haze colour in every direction, grey shadows, a veil of shafts with a hatch on it. What changed, and where (`?nomood` gives the plain water back):

- **The haze has a direction** (`hazeColor`, `src/core/underwater.js`). Aqua towards the surface, deep blue level and down (`waterBody.deep`), a halo around the sun (`sunGlow`). The matter's glow, the pane's haze, the shafts and the specks all read it.
- **Warm sun, blue shade.** The bright lines of the caustic net take a warm colour (`causticTint`). The shadows get the water's own light (`fill`), so they are blue and not the grey of the sky. Less red is absorbed, so the sand stays warm.
- **Edge light on the life** (`rimLight`): a line of surface light on the back of a fish or a blade, against the haze.
- **Separate beams** (`shaftCut`, `src/core/shafts.js`). A shaft starts above 1.5 times the mean light, not at the mean. Read with sixteen taps one texel apart (a 4 by 4 box): neighbours one texel apart cancel the jitter. Taps two texels apart all read the same phase of it and left a comb of fibres at depth edges. 16 steps instead of 8 cost about 2.5 ms more at 1080p for little: 8 stay (`?shaftsteps=` to compare).
- **Marine snow** (`src/core/snow.js`): 500 specks that sink and sway, added light, larger and dimmer near the eye.
- **Bloom and grade** (`src/camera/grade.js`), after the depth effects; `?nograde`.

A trap met: the fill is in the emissive, so a tint put on the colour afterwards does not reach it. A red fish in blue fill turned pink. `tintUnderwater( material, tint )` applies the tint to both.


