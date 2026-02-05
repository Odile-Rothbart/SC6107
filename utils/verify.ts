import { run } from "hardhat";

const verify = async (contractAddress: string, args: any[]) => {
	try {
		await run("verify:verify", {
			address: contractAddress,
			constructorArguments: args,
		});
	} catch (error: any) {
		if (error.message.toLowerCase().includes("already verified")) {
			console.log("Already verified!");
		} else console.log(error);
	}
};

export default verify;
