const { CatalogoService, Peca, FotoPeca, sequelize } = require('../src/models');
const catalogoService = require('../src/features/catalogo/catalogo.service');

async function testPhotoSaving() {
    const t = await sequelize.transaction();
    try {
        console.log('--- Testing Photo Saving ---');

        // 1. Create a Peca
        const peca = await Peca.findOne();
        if (!peca) throw new Error('No piece found');

        console.log(`Testing with Peca ID: ${peca.id}`);

        // 2. Add Photos
        const fotos = [
            '/uploads/test_photo_1.jpg',
            '/uploads/test_photo_2.jpg'
        ];

        console.log('Sending photos:', fotos);
        await catalogoService.updatePeca(peca.id, { fotos });

        // 3. Verify
        const updatedPeca = await catalogoService.getPecaById(peca.id);
        const savedPhotos = updatedPeca.fotos || [];

        console.log(`Saved Photos Count: ${savedPhotos.length}`);
        savedPhotos.forEach(f => console.log(`- ${f.url}`));

        if (savedPhotos.length === 2) {
            console.log('✅ Success: Photos saved correctly.');
        } else {
            console.log('❌ Failure: Photos NOT saved correctly.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await sequelize.close();
    }
}

testPhotoSaving();
